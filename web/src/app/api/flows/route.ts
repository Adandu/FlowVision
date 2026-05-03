import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '1h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';

  const timeFilter = buildTimeFilter({ interval, from, to });
  const extraFilters = combineFilters(
    buildIpFilter('src_ip', srcIp),
    buildIpFilter('dst_ip', dstIp),
    buildPortFilter(port),
    buildProtocolFilter(protocol)
  );
  const whereClause = extraFilters === '1=1'
    ? timeFilter
    : `${timeFilter} AND ${extraFilters}`;

  const privateSrc = `(
        match(src_ip, '^10\\\\.') OR match(src_ip, '^192\\\\.168\\\\.') OR match(src_ip, '^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')
    )`;
  const privateDst = `(
        match(dst_ip, '^10\\\\.') OR match(dst_ip, '^192\\\\.168\\\\.') OR match(dst_ip, '^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')
    )`;

  // Pre-aggregated MVs can't be filtered by IP/port/protocol.
  // When active filters are set or a custom range is selected, fall back to raw flows.
  const hasExtraFilters = extraFilters !== '1=1';
  const useRawTable = hasExtraFilters || interval === 'custom';

  try {
    let timeSeriesQuery = '';
    if (!useRawTable && (interval === '1w' || interval === '1mo' || interval === '24h')) {
      timeSeriesQuery = `
              SELECT
                hour AS time,
                toUInt64(sumMerge(bytes_sum)) AS total_bytes,
                round(total_bytes * 8 / 3600, 2) AS bits_per_second
              FROM flows_1h_mv
              WHERE hour >= now() - INTERVAL ${interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 MONTH'}
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfHour(now() - INTERVAL ${interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 MONTH'})
                TO toStartOfHour(now())
                STEP 3600`;
    } else if (!useRawTable && (interval === '10m' || interval === '1h')) {
      timeSeriesQuery = `
              SELECT
                minute AS time,
                toUInt64(sumMerge(bytes_sum)) AS total_bytes,
                round(total_bytes * 8 / 60, 2) AS bits_per_second
              FROM flows_1m_mv
              WHERE minute >= now() - INTERVAL ${interval === '10m' ? '10 MINUTE' : '1 HOUR'}
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfMinute(now() - INTERVAL ${interval === '10m' ? '10 MINUTE' : '1 HOUR'})
                TO toStartOfMinute(now())
                STEP 60`;
    } else if (interval === '5m') { // Used by Active Pages if Live
      timeSeriesQuery = `
              SELECT
                toStartOfInterval(timestamp, INTERVAL 5 SECOND) AS time,
                toUInt64(SUM(bytes)) AS total_bytes,
                round(total_bytes * 8 / 5, 2) AS bits_per_second
              FROM flows
              WHERE timestamp >= now() - INTERVAL 5 MINUTE
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfInterval(now() - INTERVAL 5 MINUTE, INTERVAL 5 SECOND)
                TO toStartOfInterval(now(), INTERVAL 5 SECOND)
                STEP 5`;
    } else if (!useRawTable) { // 1s Live Mode Dashboard (unfiltered)
      timeSeriesQuery = `
              SELECT
                toStartOfInterval(timestamp, INTERVAL 1 SECOND) AS time,
                toUInt64(SUM(bytes)) AS total_bytes,
                round(total_bytes * 8, 2) AS bits_per_second
              FROM flows
              WHERE timestamp >= now() - INTERVAL 1 MINUTE
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfInterval(now() - INTERVAL 1 MINUTE, INTERVAL 1 SECOND)
                TO toStartOfInterval(now(), INTERVAL 1 SECOND)
                STEP 1`;
    } else {
      // Filtered or custom range — query raw flows with full whereClause.
      // Pick bucket size based on interval (or default 1h for custom).
      const bucketCfg: Record<string, { fn: string; step: number; bps: string }> = {
        '1m':     { fn: 'toStartOfInterval(timestamp, INTERVAL 1 SECOND)', step: 1,    bps: 'total_bytes * 8' },
        '10m':    { fn: 'toStartOfMinute(timestamp)',                      step: 60,   bps: 'total_bytes * 8 / 60' },
        '1h':     { fn: 'toStartOfMinute(timestamp)',                      step: 60,   bps: 'total_bytes * 8 / 60' },
        '24h':    { fn: 'toStartOfHour(timestamp)',                        step: 3600, bps: 'total_bytes * 8 / 3600' },
        '1w':     { fn: 'toStartOfHour(timestamp)',                        step: 3600, bps: 'total_bytes * 8 / 3600' },
        '1mo':    { fn: 'toStartOfDay(timestamp)',                         step: 86400,bps: 'total_bytes * 8 / 86400' },
        'custom': { fn: 'toStartOfHour(timestamp)',                        step: 3600, bps: 'total_bytes * 8 / 3600' },
      };
      const cfg = bucketCfg[interval] || bucketCfg['custom'];
      timeSeriesQuery = `
              SELECT
                ${cfg.fn} AS time,
                toUInt64(SUM(bytes)) AS total_bytes,
                round(${cfg.bps}, 2) AS bits_per_second
              FROM flows
              WHERE ${whereClause}
              GROUP BY time ORDER BY time ASC`;
    }

    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10, 1), 100);

    const topDestinationsQuery = `
          SELECT dst_ip AS ip, SUM(bytes) as total_bytes
          FROM flows WHERE ${whereClause}
          GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`;

    const topSourcesQuery = `
          SELECT src_ip AS ip, SUM(bytes) as total_bytes
          FROM flows WHERE ${whereClause}
          GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`;

    const topPortsQuery = `
          SELECT
            multiIf(protocol = 6, concat('TCP ', toString(dst_port)), protocol = 17, concat('UDP ', toString(dst_port)), protocol = 1, concat('ICMP ', toString(dst_port)), concat('Other ', toString(dst_port))) AS port,
            SUM(bytes) as total_bytes
          FROM flows WHERE ${whereClause}
          GROUP BY port ORDER BY total_bytes DESC LIMIT ${limit}`;

    const protocolBreakdownQuery = `
          SELECT
            multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
            SUM(bytes) AS total_bytes
          FROM flows WHERE ${whereClause}
          GROUP BY proto ORDER BY total_bytes DESC`;

    // Always measure bps from the last 3 minutes regardless of chart interval,
    // so stat cards show current throughput rather than a diluted interval average.
    const trafficDirectionQuery = `
          SELECT
            sumIf(bytes, ${privateSrc} AND NOT ${privateDst}) AS outbound_bytes,
            sumIf(bytes, NOT ${privateSrc} AND ${privateDst}) AS inbound_bytes,
            sumIf(bytes, ${privateSrc} AND ${privateDst}) AS internal_bytes,
            sum(bytes) AS total_bytes,
            round(outbound_bytes * 8 / 180, 2) AS outbound_bps,
            round(inbound_bytes * 8 / 180, 2) AS inbound_bps,
            round(internal_bytes * 8 / 180, 2) AS internal_bps,
            round(total_bytes * 8 / 180, 2) AS total_bps
          FROM flows WHERE timestamp >= now() - INTERVAL 3 MINUTE`;

    const geoMapDataQuery = `
          SELECT ip, sum(total_bytes) as total_bytes FROM (
              SELECT dst_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE ${whereClause} GROUP BY ip
              UNION ALL
              SELECT src_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE ${whereClause} GROUP BY ip
          ) GROUP BY ip ORDER BY total_bytes DESC LIMIT 100`;

    // Separate query for Applications widget: top 100 public IPs only so internal
    // hosts (which dominate total traffic over long intervals) don't crowd out
    // internet destinations that carry application-identifying ASN data.
    const privatePattern = `'^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.'`;
    const topPublicIpsQuery = `
          SELECT ip, sum(total_bytes) as total_bytes FROM (
              SELECT dst_ip AS ip, SUM(bytes) as total_bytes FROM flows
              WHERE ${whereClause} AND NOT match(dst_ip, ${privatePattern}) GROUP BY ip
              UNION ALL
              SELECT src_ip AS ip, SUM(bytes) as total_bytes FROM flows
              WHERE ${whereClause} AND NOT match(src_ip, ${privatePattern}) GROUP BY ip
          ) GROUP BY ip ORDER BY total_bytes DESC LIMIT 100`;

    const activeCountsQuery = `
          SELECT
            uniqExact(ip) AS active_ips_distinct,
            (SELECT uniqExact(toString(dst_port)) FROM flows WHERE ${whereClause}) AS active_ports
          FROM (
            SELECT src_ip AS ip FROM flows WHERE ${whereClause}
            UNION ALL
            SELECT dst_ip AS ip FROM flows WHERE ${whereClause}
          )`;

    const [timeSeries, topDestinations, topSources, topPortsRaw, protocolBreakdown, trafficDirection, geoMapRaw, activeCounts, topPublicIpsRaw] = await Promise.all([
      clickhouse.query({ query: timeSeriesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topDestinationsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topSourcesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topPortsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: protocolBreakdownQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: trafficDirectionQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: geoMapDataQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: activeCountsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topPublicIpsQuery, format: 'JSONEachRow' }).then(res => res.json()),
    ]);

    const { getAppName } = await import('@/lib/protocols');

    // Group Top Ports by L7 Application for a cleaner chart
    const appMap = new Map<string, number>();
    for (const p of topPortsRaw as any[]) {
      // p.port looks like "TCP 443" or "UDP 53"
      const parts = p.port.split(' ');
      const portNum = parseInt(parts[1], 10);
      let name = p.port;
      if (!isNaN(portNum)) {
        const app = getAppName(portNum);
        name = app.startsWith('Port') ? p.port : app;
      }
      appMap.set(name, (appMap.get(name) || 0) + Number(p.total_bytes));
    }

    // Convert back to sorted array
    const topPorts = Array.from(appMap.entries())
      .map(([port, total_bytes]) => ({ port, total_bytes }))
      .sort((a, b) => b.total_bytes - a.total_bytes)
      .slice(0, 10);

    const user = await getCurrentUser();
    const isGuest = !user;

    // Collect all IPs we need to lookup
    const allIps = new Set<string>();
    topDestinations.forEach((d: any) => allIps.add(d.ip));
    topSources.forEach((s: any) => allIps.add(s.ip));
    geoMapRaw.forEach((g: any) => allIps.add(g.ip));
    topPublicIpsRaw.forEach((g: any) => allIps.add(g.ip));

    // Batch GeoIP Lookup (on the backend, before obfuscation)
    const { batchGeoIPLookup } = await import('@/lib/geoip');
    const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

    // --- Top Services Calculation ---
    const { identifyService } = await import('@/lib/services');
    const serviceMap = new Map<string, { total_bytes: number; color: string }>();

    // Deterministic color from a string (for unknown ASNs)
    function asnColor(label: string): string {
      let h = 0;
      for (let i = 0; i < label.length; i++) h = (Math.imul(31, h) + label.charCodeAt(i)) | 0;
      return `hsl(${((h >>> 0) % 360)}, 45%, 52%)`;
    }

    topPublicIpsRaw.forEach((g: any) => {
      const geo = geoDataMap[g.ip];
      let assigned = false;
      if (geo && !geo.private && (geo.asn || geo.isp)) {
        const svc = identifyService(geo.asn || geo.isp);
        if (svc) {
          const current = serviceMap.get(svc.name) || { total_bytes: 0, color: svc.color };
          current.total_bytes += Number(g.total_bytes);
          serviceMap.set(svc.name, current);
          assigned = true;
        }
      }

      if (!assigned && geo && !geo.private) {
        const label = geo.asn || geo.isp || 'Other';
        const color = label === 'Other' ? '#4B5563' : asnColor(label);
        const current = serviceMap.get(label) || { total_bytes: 0, color };
        current.total_bytes += Number(g.total_bytes);
        serviceMap.set(label, current);
      }
    });

    const topServices = Array.from(serviceMap.entries())
      .map(([service, data]) => ({ service, total_bytes: data.total_bytes, color: data.color }))
      .sort((a, b) => b.total_bytes - a.total_bytes)
      .slice(0, 10);
    // ---------------------------------

    // Enrich payloads with GeoIP
    topDestinations.forEach((d: any) => {
      const geo = geoDataMap[d.ip];
      if (geo) {
        d.country = geo.country;
        d.flag = geo.flag;
        d.lat = geo.lat;
        d.lon = geo.lon;
        d.asn = geo.asn;
        d.isp = geo.isp;
      }
    });

    topSources.forEach((s: any) => {
      const geo = geoDataMap[s.ip];
      if (geo) {
        s.country = geo.country;
        s.flag = geo.flag;
        s.lat = geo.lat;
        s.lon = geo.lon;
        s.asn = geo.asn;
        s.isp = geo.isp;
      }
    });

    const geoTraffic = geoMapRaw.map((g: any) => {
      const geo = geoDataMap[g.ip];
      if (geo) {
        return {
          ...g,
          country: geo.country,
          city: geo.city || '',
          lat: geo.lat,
          lon: geo.lon
        };
      }
      return g;
    }).filter((g: any) => g.lat && g.lon); // Only keep IPs with coordinates for the map

    // Apply Admin IP Aliases or Obfuscate for Guests
    if (isGuest) {
      topDestinations.forEach((d: any) => d.ip = obfuscateIp(d.ip));
      topSources.forEach((s: any) => s.ip = obfuscateIp(s.ip));
      geoTraffic.forEach((g: any) => g.ip = obfuscateIp(g.ip));
    } else {
      await applyAliases(topDestinations);
      await applyAliases(topSources);
      await applyAliases(geoTraffic);
    }

    const counts = (activeCounts as any[])[0] || {};

    return NextResponse.json({
      success: true,
      data: { timeSeries, topDestinations, topSources, topPorts, protocolBreakdown, trafficDirection: trafficDirection[0] || {}, geoTraffic, topServices, activeIpCount: Number(counts.active_ips_distinct) || 0, activePortCount: Number(counts.active_ports) || 0 }
    });
  } catch (error) {
    console.error('ClickHouse Query Error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
