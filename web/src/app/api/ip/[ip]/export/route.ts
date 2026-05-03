import { NextResponse } from 'next/server';
import { clickhouse } from '@/lib/clickhouse';
import { applyAliases } from '@/lib/aliases';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ ip: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ip } = await params;
  const url = new URL(req.url);
  const interval = url.searchParams.get('interval') || '24h';

  let timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR';

  switch (interval) {
    case '1m':  timeFilter = 'timestamp >= now() - INTERVAL 1 MINUTE'; break;
    case '10m': timeFilter = 'timestamp >= now() - INTERVAL 10 MINUTE'; break;
    case '1h':  timeFilter = 'timestamp >= now() - INTERVAL 1 HOUR'; break;
    case '24h': timeFilter = 'timestamp >= now() - INTERVAL 24 HOUR'; break;
    case '7d':
    case '1w':  timeFilter = 'timestamp >= now() - INTERVAL 7 DAY'; break;
    case '30d':
    case '1mo': timeFilter = 'timestamp >= now() - INTERVAL 30 DAY'; break;
  }

  try {
    const rows = await clickhouse.query({
      query: `
        SELECT
          max(timestamp) as timestamp,
          src_ip, dst_ip, src_port, dst_port,
          multiIf(protocol = 6, 'TCP', protocol = 17, 'UDP', protocol = 1, 'ICMP', 'Other') AS protocol,
          SUM(bytes) as bytes,
          SUM(packets) as packets
        FROM flows
        WHERE (src_ip = {ip:String} OR dst_ip = {ip:String}) AND ${timeFilter}
        GROUP BY src_ip, dst_ip, src_port, dst_port, protocol
        ORDER BY timestamp DESC
        LIMIT 10000
      `,
      query_params: { ip },
      format: 'JSONEachRow',
    }).then(r => r.json());

    await applyAliases(rows);

    const header = 'timestamp,src_ip,src_port,dst_ip,dst_port,protocol,bytes,packets\n';
    const csvRows = (rows as any[]).map(r =>
      [r.timestamp, r.src_ip, r.src_port, r.dst_ip, r.dst_port, r.protocol, r.bytes, r.packets].join(',')
    );
    const csv = header + csvRows.join('\n');

    const now = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const safeIp = ip.replace(/[^0-9.]/g, '_');
    const filename = `${now}-ip-${safeIp}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-filename': filename,
      },
    });
  } catch (error) {
    console.error('IP export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
