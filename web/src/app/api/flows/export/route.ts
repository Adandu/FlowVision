import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { getCurrentUser } from '@/lib/auth';
import { buildTimeFilter, buildIpFilter, buildProtocolFilter, buildPortFilter, combineFilters } from '@/lib/queryFilters';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get('limit') || 10000);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 10000, 1), 10000);
  const interval = searchParams.get('interval') || '24h';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const srcIp = searchParams.get('src') || '';
  const dstIp = searchParams.get('dst') || '';
  const eitherIp = searchParams.get('ip') || '';
  const port = searchParams.get('port') || '';
  const protocol = searchParams.get('proto') || '';
  const direction = searchParams.get('direction') || '';
  const minBytes = parseInt(searchParams.get('minBytes') || '0', 10) || 0;

  const timeFilter = buildTimeFilter({ interval, from, to });

  let ipFilter = '';
  if (eitherIp) {
    const ipExact = eitherIp.trim();
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ipExact)) {
      ipFilter = `(src_ip = '${ipExact}' OR dst_ip = '${ipExact}')`;
    }
  }

  const extraFilters = combineFilters(
    ipFilter,
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

  const fullWhere = combineFilters(whereClause, dirFilter);
  const havingClause = minBytes > 0 ? `HAVING SUM(bytes) >= ${minBytes}` : '';

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
        ${havingClause}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      format: 'JSONEachRow',
    }).then(r => r.json());

    const { applyAliases } = await import('@/lib/aliases');
    await applyAliases(rows);

    const header = 'timestamp,src_ip,src_port,dst_ip,dst_port,protocol,bytes,packets\n';
    const csvRows = (rows as any[]).map(r =>
      [r.timestamp, r.src_ip, r.src_port, r.dst_ip, r.dst_port, r.protocol, r.bytes, r.packets].join(',')
    );
    const csv = header + csvRows.join('\n');

    const now = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const filename = `${now}-flows.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-filename': filename,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
