const { ipMatches } = require('../../lib/utils');

describe('ipMatches', () => {
  test('allows localhost IPv4', () => {
    expect(ipMatches('127.0.0.1', '192.168.1.0/24')).toBe(true);
  });

  test('allows localhost IPv6', () => {
    expect(ipMatches('::1', '192.168.1.0/24')).toBe(true);
  });

  test('strips IPv6-mapped IPv4 prefix', () => {
    expect(ipMatches('::ffff:192.168.1.50', '192.168.1.50')).toBe(true);
  });

  test('matches exact IP', () => {
    expect(ipMatches('192.168.1.100', '192.168.1.100')).toBe(true);
    expect(ipMatches('192.168.1.100', '192.168.1.101')).toBe(false);
  });

  test('matches /24 subnet', () => {
    expect(ipMatches('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.1.255', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.2.50', '192.168.1.0/24')).toBe(false);
  });

  test('rejects non-matching IP', () => {
    expect(ipMatches('10.0.0.5', '192.168.1.100')).toBe(false);
  });
});
