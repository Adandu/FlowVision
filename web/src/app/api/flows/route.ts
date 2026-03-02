import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '1h';

  let timeFilter = '';
  switch (interval) {
    case '1m': timeFilter = 'timestamp >= now() - INTERVAL 1 MINUTE'; break;
    case '5m': timeFilter = 'timestamp >= now() - INTERVAL 5 MINUTE'; break;
    case '10m': timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE'; break;
    case '1h': timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR'; break;
    case '24h': timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR'; break;
    case '1w': timeFilter = 'timestamp >= now() - INTERVAL 1 WEEK'; break;
    case '1mo': timeFilter = 'timestamp >= now() - INTERVAL 1 MONTH'; break;
    default: timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR';
  }

  const privateSubnet = `(
        match(src_ip, '^10\\\\.') OR match(src_ip, '^192\\\\.168\\\\.') OR match(src_ip, '^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')
    )`;
  const privateDst = `(
        match(dst_ip, '^10\\\\.') OR match(dst_ip, '^192\\\\.168\\\\.') OR match(dst_ip, '^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')
    )`;

  try {
    let timeSeriesQuery = '';
    if (interval === '1w' || interval === '1mo' || interval === '24h') {
      timeSeriesQuery = `
              SELECT hour AS time, toUInt64(sumMerge(bytes_sum)) AS total_bytes
              FROM flows_1h_mv
              WHERE hour >= now() - INTERVAL ${interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 MONTH'}
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfHour(now() - INTERVAL ${interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 MONTH'})
                TO toStartOfHour(now())
                STEP 3600`;
    } else if (interval === '10m' || interval === '1h') {
      timeSeriesQuery = `
              SELECT minute AS time, toUInt64(sumMerge(bytes_sum)) AS total_bytes
              FROM flows_1m_mv
              WHERE minute >= now() - INTERVAL ${interval === '10m' ? '10 MINUTE' : '1 HOUR'}
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfMinute(now() - INTERVAL ${interval === '10m' ? '10 MINUTE' : '1 HOUR'})
                TO toStartOfMinute(now())
                STEP 60`;
    } else if (interval === '5m') { // Used by Active Pages if Live
      timeSeriesQuery = `
              SELECT toStartOfInterval(timestamp, INTERVAL 5 SECOND) AS time, toUInt64(SUM(bytes)) AS total_bytes
              FROM flows
              WHERE timestamp >= now() - INTERVAL 5 MINUTE
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfInterval(now() - INTERVAL 5 MINUTE, INTERVAL 5 SECOND)
                TO toStartOfInterval(now(), INTERVAL 5 SECOND)
                STEP 5`;
    } else { // 3m Live Mode Dashboard
      timeSeriesQuery = `
              SELECT toStartOfInterval(timestamp, INTERVAL 3 SECOND) AS time, toUInt64(SUM(bytes)) AS total_bytes
              FROM flows
              WHERE timestamp >= now() - INTERVAL 1 MINUTE
              GROUP BY time ORDER BY time ASC
              WITH FILL
                FROM toStartOfInterval(now() - INTERVAL 1 MINUTE, INTERVAL 3 SECOND)
                TO toStartOfInterval(now(), INTERVAL 3 SECOND)
                STEP 3`;
    }

    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const topDestinationsQuery = `
          SELECT dst_ip AS ip, SUM(bytes) as total_bytes
          FROM flows WHERE ${timeFilter}
          GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`;

    const topSourcesQuery = `
          SELECT src_ip AS ip, SUM(bytes) as total_bytes
          FROM flows WHERE ${timeFilter}
          GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`;

    const topPortsQuery = `
          SELECT
            multiIf(protocol = 6, concat('TCP ', toString(dst_port)), protocol = 17, concat('UDP ', toString(dst_port)), protocol = 1, concat('ICMP ', toString(dst_port)), concat('Other ', toString(dst_port))) AS port,
            SUM(bytes) as total_bytes
          FROM flows WHERE ${timeFilter}
          GROUP BY port ORDER BY total_bytes DESC LIMIT ${limit}`;

    const protocolBreakdownQuery = `
          SELECT
            multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
            SUM(bytes) AS total_bytes
          FROM flows WHERE ${timeFilter}
          GROUP BY proto ORDER BY total_bytes DESC`;

    const trafficDirectionQuery = `
          SELECT
            sumIf(bytes, ${privateSubnet} AND NOT ${privateDst}) AS outbound_bytes,
            sumIf(bytes, NOT ${privateSubnet} AND ${privateDst}) AS inbound_bytes,
            sumIf(bytes, ${privateSubnet} AND ${privateDst}) AS internal_bytes
          FROM flows WHERE ${timeFilter}`;

    const geoMapDataQuery = `
          SELECT ip, sum(total_bytes) as total_bytes FROM (
              SELECT dst_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE ${timeFilter} GROUP BY ip
              UNION ALL
              SELECT src_ip AS ip, SUM(bytes) as total_bytes FROM flows WHERE ${timeFilter} GROUP BY ip
          ) GROUP BY ip ORDER BY total_bytes DESC LIMIT 100`;

    const [timeSeries, topDestinations, topSources, topPortsRaw, protocolBreakdown, trafficDirection, geoMapRaw] = await Promise.all([
      clickhouse.query({ query: timeSeriesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topDestinationsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topSourcesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topPortsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: protocolBreakdownQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: trafficDirectionQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: geoMapDataQuery, format: 'JSONEachRow' }).then(res => res.json()),
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

    // Batch GeoIP Lookup (on the backend, before obfuscation)
    const { batchGeoIPLookup } = await import('@/lib/geoip');
    const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

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

    return NextResponse.json({
      success: true,
      data: { timeSeries, topDestinations, topSources, topPorts, protocolBreakdown, trafficDirection: trafficDirection[0] || {}, geoTraffic }
    });
  } catch (error) {
    console.error('ClickHouse Query Error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
