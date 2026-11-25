export interface UrlGuardResult {
  ok: boolean;
  message?: string;
}

/**
 * Lightweight client-side guard. The authoritative SSRF + URL validation
 * happens on the backend (DNS resolution, private ranges, redirects).
 */
export function validateMediaUrl(value: string): UrlGuardResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: 'Paste a media URL to analyze.' };
  if (/[\s<>"]/.test(trimmed)) {
    return { ok: false, message: 'The URL contains invalid characters.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: 'Enter a valid URL, including https://.' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, message: 'Only HTTP and HTTPS URLs are supported.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'URLs with embedded credentials are not allowed.' };
  }
  if (parsed.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
    return { ok: false, message: 'Local and raw IP addresses cannot be analyzed.' };
  }
  return { ok: true };
}
