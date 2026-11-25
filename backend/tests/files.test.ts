import { describe, expect, it } from 'vitest';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  extensionForMime,
  isAllowedMediaExtension,
  isAllowedMediaMime,
  isMediaContentType,
  sanitizeBaseName,
  sanitizeFileNameWithExtension,
} from '../src/utils/files';

describe('sanitizeBaseName', () => {
  it('strips directory traversal', () => {
    expect(sanitizeBaseName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeBaseName('..\\..\\Windows\\system32\\cmd')).toBe('cmd');
    expect(sanitizeBaseName('C:\\Users\\me\\clip.mp4')).toBe('clip');
  });

  it('removes null bytes and control characters', () => {
    expect(sanitizeBaseName('evil\u0000name')).toBe('evilname');
    expect(sanitizeBaseName('a\u001fb')).toBe('a b');
  });

  it('removes characters that are invalid on Windows', () => {
    expect(sanitizeBaseName('a*b?c"d<e>f|g')).toBe('a b c d e f g');
    expect(sanitizeBaseName('a:b')).not.toMatch(/[\\/:*?"<>|]/);
    expect(sanitizeBaseName('clip.mp4:stream')).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('drops a trailing audio/video extension', () => {
    expect(sanitizeBaseName('My Song.mp3')).toBe('My Song');
    expect(sanitizeBaseName('My Movie.MP4')).toBe('My Movie');
  });

  it('never returns a hidden or reserved name', () => {
    expect(sanitizeBaseName('...')).toBe('mediaflow-output');
    expect(sanitizeBaseName('')).toBe('mediaflow-output');
    expect(sanitizeBaseName('CON')).toBe('mediaflow-output-CON');
  });

  it('caps the length', () => {
    expect(sanitizeBaseName('a'.repeat(500)).length).toBeLessThanOrEqual(110);
  });
});

describe('sanitizeFileNameWithExtension', () => {
  it('keeps the extension but strips paths', () => {
    expect(sanitizeFileNameWithExtension('/tmp/clip.mp4')).toBe('clip.mp4');
    expect(sanitizeFileNameWithExtension('..\\..\\clip.mp4')).toBe('clip.mp4');
  });

  it('falls back for empty names', () => {
    expect(sanitizeFileNameWithExtension('')).toBe('uploaded-media');
  });
});

describe('upload validation', () => {
  it('accepts known media extensions case-insensitively', () => {
    expect(isAllowedMediaExtension('CLIP.MP4')).toBe(true);
    expect(isAllowedMediaExtension('song.flac')).toBe(true);
    expect(isAllowedMediaExtension('notes.txt')).toBe(false);
    expect(isAllowedMediaExtension('no-extension')).toBe(false);
    expect(isAllowedMediaExtension('clip.mp4.exe')).toBe(false);
  });

  it('rejects every extension not on the allow-list', () => {
    for (const ext of ['.exe', '.bat', '.html', '.js', '.zip', '.']) {
      expect(isAllowedMediaExtension(`file${ext}`)).toBe(false);
    }
    expect(ALLOWED_UPLOAD_EXTENSIONS).toContain('.mp4');
  });

  it('accepts audio/video MIME types and generic binary, rejects others', () => {
    expect(isAllowedMediaMime('video/mp4')).toBe(true);
    expect(isAllowedMediaMime('audio/mpeg')).toBe(true);
    expect(isAllowedMediaMime('video/x-matroska; codecs=avc1')).toBe(true);
    expect(isAllowedMediaMime('application/octet-stream')).toBe(true);
    expect(isAllowedMediaMime('text/html')).toBe(false);
    expect(isAllowedMediaMime('application/pdf')).toBe(false);
    expect(isAllowedMediaMime(null)).toBe(false);
  });

  it('detects media content types from response headers', () => {
    expect(isMediaContentType('video/mp4')).toBe(true);
    expect(isMediaContentType('audio/ogg; codecs=opus')).toBe(true);
    expect(isMediaContentType('text/html; charset=utf-8')).toBe(false);
    expect(isMediaContentType(null)).toBe(false);
  });

  it('maps MIME types to extensions', () => {
    expect(extensionForMime('audio/mpeg')).toBe('.mp3');
    expect(extensionForMime('video/mp4')).toBe('.mp4');
    expect(extensionForMime('application/zip')).toBeNull();
  });
});
