import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get('interval') || '1h';

  let timeFilter = '';
  switch (interval) {
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
              SELECT hour AS time, sumMerge(bytes_sum) AS total_bytes
              FROM flows_1h_mv
              WHERE hour >= now() - INTERVAL ${interval === '24h' ? '24 HOUR' : interval === '1w' ? '1 WEEK' : '1 MONTH'}
              GROUP BY time ORDER BY time ASC`;
    } else if (interval === '10m' || interval === '1h') {
      timeSeriesQuery = `
              SELECT minute AS time, sumMerge(bytes_sum) AS total_bytes
              FROM flows_1m_mv
              WHERE minute >= now() - INTERVAL ${interval === '10m' ? '10 MINUTE' : '1 HOUR'}
              GROUP BY time ORDER BY time ASC`;
    } else { // 5m Live Mode
      timeSeriesQuery = `
              SELECT toStartOfInterval(timestamp, INTERVAL 5 SECOND) AS time, SUM(bytes) AS total_bytes
              FROM flows
              WHERE timestamp >= now() - INTERVAL 5 MINUTE
              GROUP BY time ORDER BY time ASC`;
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
            sumIf(bytes, NOT ${privateSubnet}) AS inbound_bytes,
            sumIf(bytes, ${privateSubnet} AND ${privateDst}) AS internal_bytes
          FROM flows WHERE ${timeFilter}`;

    const [timeSeries, topDestinations, topSources, topPortsRaw, protocolBreakdown, trafficDirection] = await Promise.all([
      clickhouse.query({ query: timeSeriesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topDestinationsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topSourcesQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: topPortsQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: protocolBreakdownQuery, format: 'JSONEachRow' }).then(res => res.json()),
      clickhouse.query({ query: trafficDirectionQuery, format: 'JSONEachRow' }).then(res => res.json()),
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

    // Apply Admin IP Aliases
    await applyAliases(topDestinations);
    await applyAliases(topSources);

    return NextResponse.json({
      success: true,
      data: { timeSeries, topDestinations, topSources, topPorts, protocolBreakdown, trafficDirection: trafficDirection[0] || {} }
    });
  } catch (error) {
    console.error('ClickHouse Query Error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
