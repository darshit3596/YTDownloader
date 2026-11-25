import path from 'node:path';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { downloadRemoteMedia } from '../utils/remote-fetch';
import { storagePaths } from '../utils/paths';
import { sanitizeBaseName } from '../utils/files';
import { probeMedia } from '../services/ffmpeg.service';
import type { AnalyzedMedia, MediaProvider } from './types';

export const directUrlProvider: MediaProvider = {
  id: 'direct',
  label: 'Direct media URL',

  canHandle(url: string): boolean {
    return /^https?:\/\//i.test(url);
  },

  async analyze(url: string): Promise<AnalyzedMedia> {
    const downloaded = await downloadRemoteMedia(
      url,
      storagePaths.temp,
      config.limits.maxRemoteFileBytes,
    );

    try {
      const probe = await probeMedia(downloaded.filePath);
      const extFromContent = downloaded.filePath.slice(downloaded.filePath.lastIndexOf('.'));
      const displayName = sanitizeBaseName(downloaded.titleHint || 'MediaFlow source');
      const title = sanitizeBaseName(probe.title || downloaded.titleHint || displayName).slice(0, 180);

      return {
        sourceUrl: url,
        title: title || 'Fetched media',
        thumbnail: null,
        duration: probe.duration,
        sourceType: 'direct_url',
        provider: 'direct',
        mimeType: probe.mimeType,
        fileName: `${displayName}${extFromContent}`,
        fileSize: downloaded.bytes,
        width: probe.width,
        height: probe.height,
        hasAudio: probe.hasAudio,
        hasVideo: probe.hasVideo,
        channel: null,
        authorUrl: null,
        storedPath: downloaded.filePath,
      };
    } catch (error) {
      await import('node:fs/promises')
        .then((fs) => fs.unlink(downloaded.filePath))
        .catch(() => undefined);
      throw error;
    }
  },
};

export function inferDirectExtension(url: string): string | null {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : null;
  } catch {
    return null;
  }
}

export function assertHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError(400, 'INVALID_URL', 'Enter a valid URL including https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(400, 'UNSUPPORTED_PROTOCOL', 'Only http and https URLs are supported.');
  }
}
