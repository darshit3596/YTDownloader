import { describe, expect, it } from 'vitest';
import {
  assertSafeUrl,
  isBlockedHostname,
  isPrivateAddress,
  isPrivateIpv4,
  isPrivateIpv6,
} from '../src/utils/network';

describe('isPrivateIpv4', () => {
  it.each([
    '0.0.0.0',
    '127.0.0.1',
    '127.255.255.254',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '999.1.1.1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPrivateIpv4(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '192.169.0.1'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateIpv4(ip)).toBe(false);
    },
  );
});

describe('isPrivateIpv6', () => {
  it.each([
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.0.1',
    '::ffff:7f00:1',
    '::7f00:1',
    '::ffff:c0a8:1',
  ])('blocks %s', (ip) => {
    expect(isPrivateIpv6(ip)).toBe(true);
  });

  it.each(['2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateIpv6(ip)).toBe(false);
    },
  );
});

describe('isPrivateAddress', () => {
  it('treats invalid addresses as unsafe', () => {
    expect(isPrivateAddress('example.com')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('isBlockedHostname', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    'app.localhost',
    'printer.local',
    'metadata.google.internal',
    '169.254.169.254',
    '127.0.0.1',
    '10.0.0.1',
    '::1',
    '',
  ])('blocks %s', (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it.each(['example.com', 'download.samplelib.com', '8.8.8.8'])('allows %s', (host) => {
    expect(isBlockedHostname(host)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  const expectCode = async (url: string, code: string) => {
    await expect(assertSafeUrl(url)).rejects.toMatchObject({ code });
  };

  it('rejects non-HTTP protocols', async () => {
    await expectCode('file:///C:/Windows/win.ini', 'UNSUPPORTED_PROTOCOL');
    await expectCode('ftp://example.com/file.mp4', 'UNSUPPORTED_PROTOCOL');
    await expectCode('data:text/plain,hello', 'UNSUPPORTED_PROTOCOL');
  });

  it('rejects malformed URLs', async () => {
    await expectCode('not a url', 'INVALID_URL');
  });

  it('rejects embedded credentials', async () => {
    await expectCode('https://user:pass@example.com/video.mp4', 'URL_CREDENTIALS_BLOCKED');
  });

  it('rejects loopback, private ranges and cloud metadata', async () => {
    await expectCode('http://127.0.0.1/', 'SSRF_BLOCKED');
    await expectCode('http://127.0.0.1:4000/api/health', 'SSRF_BLOCKED');
    await expectCode('http://localhost/', 'SSRF_BLOCKED');
    await expectCode('http://169.254.169.254/latest/meta-data', 'SSRF_BLOCKED');
    await expectCode('http://10.0.0.5/video.mp4', 'SSRF_BLOCKED');
    await expectCode('http://192.168.1.20/video.mp4', 'SSRF_BLOCKED');
    await expectCode('http://[::1]/video.mp4', 'SSRF_BLOCKED');
    await expectCode('http://[::ffff:127.0.0.1]/', 'SSRF_BLOCKED');
  });

  it('rejects decimal/hex IP obfuscation that resolves privately', async () => {
    // 2130706433 is 127.0.0.1 encoded as a 32-bit integer.
    const error = await assertSafeUrl('http://2130706433/').catch((cause: unknown) => cause);
    expect(['SSRF_BLOCKED', 'DNS_RESOLUTION_FAILED']).toContain(
      (error as { code?: string }).code,
    );
  });

  it('accepts a public HTTPS URL', async () => {
    const resolved = await assertSafeUrl('https://example.com/media.mp4');
    expect(resolved.url.hostname).toBe('example.com');
    expect(resolved.addresses.length).toBeGreaterThan(0);
  });
});
