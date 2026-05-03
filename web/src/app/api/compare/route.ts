import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

function buildCustomTimeFilter(from: string, to: string): string {
  if (from && to) {
    return `timestamp >= parseDateTimeBestEffort('${from}') AND timestamp <= parseDateTimeBestEffort('${to}')`;
  }
  if (from) return `timestamp >= parseDateTimeBestEffort('${from}')`;
  if (to) return `timestamp <= parseDateTimeBestEffort('${to}')`;
  return '1=1';
}

async function fetchPeriodData(timeFilter: string, extraFilters: string, limit: number) {
  const whereClause = extraFilters === '1=1'
    ? timeFilter
    : `${timeFilter} AND ${extraFilters}`;

  const privateSrc = `match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;
  const privateDst = `match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;

  const [summary, topDst, topSrc, topPorts, protocols] = await Promise.all([
    clickhouse.query({
      query: `
        SELECT
          sum(bytes) AS total_bytes,
          count() AS total_flows,
          uniqExact(src_ip) AS unique_src,
          uniqExact(dst_ip) AS unique_dst,
          sumIf(bytes, ${privateSrc} AND NOT ${privateDst}) AS outbound_bytes,
          sumIf(bytes, NOT ${privateSrc} AND ${privateDst}) AS inbound_bytes,
          sumIf(bytes, ${privateSrc} AND ${privateDst}) AS internal_bytes
        FROM flows WHERE ${whereClause}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT dst_ip AS ip, SUM(bytes) AS total_bytes FROM flows WHERE ${whereClause} GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `SELECT src_ip AS ip, SUM(bytes) AS total_bytes FROM flows WHERE ${whereClause} GROUP BY ip ORDER BY total_bytes DESC LIMIT ${limit}`,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `
        SELECT
          multiIf(protocol = 6, concat('TCP ', toString(dst_port)), protocol = 17, concat('UDP ', toString(dst_port)), protocol = 1, concat('ICMP ', toString(dst_port)), concat('Other ', toString(dst_port))) AS port,
          SUM(bytes) AS total_bytes
        FROM flows WHERE ${whereClause}
        GROUP BY port ORDER BY total_bytes DESC LIMIT ${limit}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json()),

    clickhouse.query({
      query: `
        SELECT
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS proto,
          SUM(bytes) AS total_bytes
        FROM flows WHERE ${whereClause}
        GROUP BY proto ORDER BY total_bytes DESC
      `,
      format: 'JSONEachRow',
    }).then(r => r.json()),
  ]);

  return {
    summary: summary[0] || {},
    topDestinations: topDst,
    topSources: topSrc,
    topPorts: topPorts,
    protocols,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const fromA = searchParams.get('fromA') || '';
  const toA = searchParams.get('toA') || '';
  const fromB = searchParams.get('fromB') || '';
  const toB = searchParams.get('toB') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  const extraFilters = combineFilters(
    buildIpFilter('src_ip', srcIp),
    buildIpFilter('dst_ip', dstIp),
    buildPortFilter(port),
    buildProtocolFilter(protocol)
  );

  const timeFilterA = buildCustomTimeFilter(fromA, toA);
  const timeFilterB = buildCustomTimeFilter(fromB, toB);

  try {
    const [periodA, periodB] = await Promise.all([
      fetchPeriodData(timeFilterA, extraFilters, limit),
      fetchPeriodData(timeFilterB, extraFilters, limit),
    ]);

    const user = await getCurrentUser();
    const isGuest = !user;

    if (isGuest) {
      const obfuscate = (arr: any[], key = 'ip') => arr.forEach(r => { r[key] = obfuscateIp(r[key]); });
      obfuscate(periodA.topDestinations);
      obfuscate(periodA.topSources);
      obfuscate(periodB.topDestinations);
      obfuscate(periodB.topSources);
    }

    return NextResponse.json({ success: true, data: { periodA, periodB } });
  } catch (error) {
    console.error('Compare API error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
