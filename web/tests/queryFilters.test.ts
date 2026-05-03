import { describe, it, expect } from 'vitest';
import {
  buildTimeFilter,
  buildIpFilter,
  buildProtocolFilter,
  buildPortFilter,
  combineFilters,
} from '@/lib/queryFilters';

describe('buildTimeFilter', () => {
  it('returns 1h filter for default', () => {
    expect(buildTimeFilter({ interval: '1h' })).toBe(
      'timestamp >= now() - INTERVAL 1 HOUR'
    );
  });
  it('returns 24h filter', () => {
    expect(buildTimeFilter({ interval: '24h' })).toBe(
      'timestamp >= now() - INTERVAL 24 HOUR'
    );
  });
  it('returns custom range when interval is custom', () => {
    expect(buildTimeFilter({ interval: 'custom', from: '2026-05-01T00:00:00', to: '2026-05-02T00:00:00' })).toBe(
      "timestamp >= '2026-05-01 00:00:00' AND timestamp <= '2026-05-02 00:00:00'"
    );
  });
  it('falls back to 1h when custom but no dates', () => {
    expect(buildTimeFilter({ interval: 'custom' })).toBe(
      'timestamp >= now() - INTERVAL 1 HOUR'
    );
  });
});

describe('buildIpFilter', () => {
  it('builds exact IP filter', () => {
    expect(buildIpFilter('src_ip', '192.168.1.1')).toBe("src_ip = '192.168.1.1'");
  });
  it('builds CIDR filter', () => {
    expect(buildIpFilter('dst_ip', '10.0.0.0/8')).toBe("isIPAddressInRange(dst_ip, '10.0.0.0/8')");
  });
  it('returns empty string for empty input', () => {
    expect(buildIpFilter('src_ip', '')).toBe('');
  });
  it('returns empty string for invalid input', () => {
    expect(buildIpFilter('src_ip', 'DROP TABLE flows')).toBe('');
  });
});

describe('buildProtocolFilter', () => {
  it('returns TCP filter', () => {
    expect(buildProtocolFilter('tcp')).toBe('protocol = 6');
  });
  it('returns UDP filter', () => {
    expect(buildProtocolFilter('udp')).toBe('protocol = 17');
  });
  it('returns ICMP filter', () => {
    expect(buildProtocolFilter('icmp')).toBe('protocol = 1');
  });
  it('returns empty string for any/empty', () => {
    expect(buildProtocolFilter('')).toBe('');
    expect(buildProtocolFilter('any')).toBe('');
  });
});

describe('buildPortFilter', () => {
  it('builds port filter for valid port', () => {
    expect(buildPortFilter('443')).toBe('dst_port = 443');
  });
  it('returns empty for empty string', () => {
    expect(buildPortFilter('')).toBe('');
  });
  it('returns empty for out-of-range port', () => {
    expect(buildPortFilter('99999')).toBe('');
  });
  it('returns empty for non-numeric input', () => {
    expect(buildPortFilter('abc')).toBe('');
  });
});

describe('combineFilters', () => {
  it('joins multiple conditions with AND', () => {
    expect(combineFilters('a = 1', 'b = 2')).toBe('a = 1 AND b = 2');
  });
  it('skips empty conditions', () => {
    expect(combineFilters('a = 1', '', 'c = 3')).toBe('a = 1 AND c = 3');
  });
  it('returns 1=1 when all empty', () => {
    expect(combineFilters('', '')).toBe('1=1');
  });
});
