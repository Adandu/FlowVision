export interface FilterParams {
  srcIp?: string;
  dstIp?: string;
  port?: string;
  protocol?: string;
  interval?: string;
  from?: string;
  to?: string;
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

function sanitizeDatetime(dt: string): string {
  return dt.replace(/[^0-9T:\-.Z]/g, '').slice(0, 24);
}

export function buildTimeFilter(params: Pick<FilterParams, 'interval' | 'from' | 'to'>): string {
  const { interval = '1h', from, to } = params;
  if (interval === 'custom' && from && to) {
    const f = sanitizeDatetime(from).replace('T', ' ').slice(0, 19);
    const t = sanitizeDatetime(to).replace('T', ' ').slice(0, 19);
    return `timestamp >= '${f}' AND timestamp <= '${t}'`;
  }
  switch (interval) {
    case '1m':
    case 'Live': return 'timestamp >= now() - INTERVAL 1 MINUTE';
    case '10m': return 'timestamp >= now() - INTERVAL 10 MINUTE';
    case '24h': return 'timestamp >= now() - INTERVAL 24 HOUR';
    case '1w': return 'timestamp >= now() - INTERVAL 1 WEEK';
    case '1mo': return 'timestamp >= now() - INTERVAL 1 MONTH';
    default: return 'timestamp >= now() - INTERVAL 1 HOUR';
  }
}

export function buildIpFilter(field: 'src_ip' | 'dst_ip', ipOrCidr: string): string {
  if (!ipOrCidr.trim()) return '';
  const v = ipOrCidr.trim();
  if (CIDR_RE.test(v)) return `isIPAddressInRange(${field}, '${v}')`;
  if (IP_RE.test(v)) return `${field} = '${v}'`;
  return '';
}

export function buildProtocolFilter(protocol: string): string {
  switch (protocol.toLowerCase()) {
    case 'tcp': return 'protocol = 6';
    case 'udp': return 'protocol = 17';
    case 'icmp': return 'protocol = 1';
    default: return '';
  }
}

export function buildPortFilter(port: string): string {
  const n = parseInt(port, 10);
  if (!port || isNaN(n) || n < 0 || n > 65535) return '';
  return `dst_port = ${n}`;
}

export function combineFilters(...conditions: string[]): string {
  const active = conditions.filter(Boolean);
  return active.length > 0 ? active.join(' AND ') : '1=1';
}
