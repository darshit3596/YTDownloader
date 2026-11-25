import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError, badRequest } from '../middleware/error-handler';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  '169.254.169.254',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan'];

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 192 && b === 88) return true; // 6to4 relay
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function expandIpv6(input: string): number[] | null {
  const normalized = input.split('%')[0].trim();
  if (!normalized.includes(':')) return null;

  let text = normalized;
  // Normalise a trailing dotted-quad (e.g. ::ffff:192.168.0.1) into hextets.
  const dotted = text.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const [, prefix, a, b, c, d] = dotted;
    const octets = [a, b, c, d].map(Number);
    if (octets.some((octet) => octet < 0 || octet > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    text = `${prefix}${high}:${low}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const groups = part.split(':').map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
    return groups.some(Number.isNaN) ? null : groups;
  };

  const head = parseGroups(halves[0]);
  if (!head) return null;

  let groups: number[];
  if (halves.length === 2) {
    const tail = parseGroups(halves[1]);
    if (!tail) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<number>(missing).fill(0), ...tail];
  } else {
    groups = head;
  }

  return groups.length === 8 ? groups : null;
}

export function isPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip.toLowerCase());
  // Unparseable addresses are treated as unsafe.
  if (!groups) return true;

  if (groups.every((group) => group === 0)) return true; // ::
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) addresses.
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    (groups[5] === 0xffff || groups[5] === 0)
  ) {
    const ipv4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
    return isPrivateIpv4(ipv4);
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((groups[0] & 0xff00) === 0xff00) return true; // multicast
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // documentation
  if (groups[0] === 0x2001 && groups[1] === 0x0000) return true; // Teredo
  if (groups[0] === 0x0064 && groups[1] === 0xff9b) return true; // NAT64
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (net.isIP(host) && isPrivateAddress(host)) return true;
  return false;
}

export interface ResolvedTarget {
  url: URL;
  addresses: string[];
}

/**
 * Validates an outbound URL for SSRF safety:
 * protocol allow-list, no credentials, no blocked hostnames,
 * and every DNS answer must be a public address.
 */
export async function assertSafeUrl(input: string): Promise<ResolvedTarget> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw badRequest('That does not look like a valid URL.', 'INVALID_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw badRequest('Only http and https URLs are supported.', 'UNSUPPORTED_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw badRequest('URLs containing credentials are not allowed.', 'URL_CREDENTIALS_BLOCKED');
  }
  if (parsed.hostname.length > 253) {
    throw badRequest('The URL hostname is too long.', 'INVALID_URL');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(hostname)) {
    throw new AppError(
      400,
      'SSRF_BLOCKED',
      'This host is blocked. Only public media hosts are allowed.',
    );
  }

  let addresses: string[];
  if (net.isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true, verbatim: true });
      addresses = records.map((record) => record.address);
    } catch {
      throw new AppError(400, 'DNS_RESOLUTION_FAILED', 'The media host could not be resolved.');
    }
  }

  if (addresses.length === 0) {
    throw new AppError(400, 'DNS_RESOLUTION_FAILED', 'The media host has no usable address.');
  }
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new AppError(
      400,
      'SSRF_BLOCKED',
      'This URL resolves to a private or loopback address and cannot be fetched.',
    );
  }

  return { url: parsed, addresses };
}
