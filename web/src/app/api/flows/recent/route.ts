import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser, obfuscateIp } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get('limit') || 100);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);
  const interval = searchParams.get('interval') || '24h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';
  const direction = searchParams.get('direction') || '';
  const minBytes = parseInt(searchParams.get('minBytes') || '0', 10) || 0;

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

  const privSrc = `match(src_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;
  const privDst = `match(dst_ip, '^10\\\\.|^192\\\\.168\\\\.|^172\\\\.(1[6-9]|2[0-9]|3[01])\\\\.')`;

  let dirFilter = '';
  if (direction === 'outbound') dirFilter = `${privSrc} AND NOT ${privDst}`;
  else if (direction === 'inbound') dirFilter = `NOT ${privSrc} AND ${privDst}`;
  else if (direction === 'internal') dirFilter = `${privSrc} AND ${privDst}`;

  const fullWhere = combineFilters(whereClause, dirFilter, minBytes > 0 ? `bytes >= ${minBytes}` : '');

  try {
    const rows = await clickhouse.query({
      query: `
        SELECT
          max(ts) as timestamp,
          src_ip, dst_ip, src_port, dst_port,
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
          SUM(bytes) as bytes,
          SUM(packets) as packets
        FROM (
          SELECT timestamp AS ts, src_ip, dst_ip, src_port, dst_port, protocol, bytes, packets
          FROM flows
          WHERE ${fullWhere}
        )
        GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json());

    const user = await getCurrentUser();
    const isGuest = !user;

    const allIps = new Set<string>();
    rows.forEach((r: any) => {
      if (r.src_ip) allIps.add(r.src_ip);
      if (r.dst_ip) allIps.add(r.dst_ip);
    });

    const { batchGeoIPLookup } = await import('@/lib/geoip');
    const geoDataMap = await batchGeoIPLookup(Array.from(allIps));

    rows.forEach((r: any) => {
      const srcGeo = geoDataMap[r.src_ip];
      if (srcGeo) r.src_asn = srcGeo.asn || srcGeo.isp;
      const dstGeo = geoDataMap[r.dst_ip];
      if (dstGeo) r.dst_asn = dstGeo.asn || dstGeo.isp;
    });

    if (isGuest) {
      rows.forEach((r: any) => {
        r.src_ip = obfuscateIp(r.src_ip);
        r.dst_ip = obfuscateIp(r.dst_ip);
      });
    } else {
      await applyAliases(rows);
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Recent flows error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}
