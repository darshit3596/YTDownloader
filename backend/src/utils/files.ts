import path from 'node:path';

const INVALID_CHARS = /[\\/:*?"<>|\u0000-\u001f\u0080-\u009f]/g;

/**
 * Produces a safe base name (no extension, no directories, no reserved names).
 * Never pass raw user input into a filesystem path without this.
 */
export function sanitizeBaseName(input: string, fallback = 'mediaflow-output'): string {
  const base = path.basename(String(input ?? '').replace(/\0/g, ''));
  let cleaned = base
    .replace(INVALID_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim();

  cleaned = cleaned.replace(/\.(mp3|mp4)$/i, '').trim();
  if (!cleaned) return fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) cleaned = `${fallback}-${cleaned}`;
  return cleaned.slice(0, 110).trim() || fallback;
}

export function sanitizeFileNameWithExtension(input: string, fallback = 'uploaded-media'): string {
  const base = path.basename(String(input ?? '').replace(/\0/g, ''));
  const cleaned = base
    .replace(INVALID_CHARS, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim();
  return cleaned.slice(0, 160) || fallback;
}

export function extensionForMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'video/x-matroska': '.mkv',
    'video/x-msvideo': '.avi',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'audio/ogg': '.ogg',
    'audio/opus': '.opus',
    'video/mpeg': '.mpeg',
    'video/mp2t': '.ts',
  };
  return map[mime.split(';')[0].trim().toLowerCase()] ?? null;
}

export const ALLOWED_UPLOAD_EXTENSIONS = [
  '.mp4',
  '.m4v',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.opus',
] as const;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/mpeg',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/opus',
  'application/octet-stream',
] as const;

export function isAllowedMediaExtension(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedMediaMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('video/') || normalized.startsWith('audio/')) return true;
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(normalized);
}

export function isMediaContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return normalized.startsWith('video/') || normalized.startsWith('audio/');
}
