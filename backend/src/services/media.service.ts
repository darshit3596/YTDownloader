import fs from 'node:fs/promises';
import { prisma } from '../database/prisma';
import { resolveProvider } from '../providers';
import { assertSafeUrl } from '../utils/network';
import { probeMedia } from './ffmpeg.service';
import { sanitizeBaseName, sanitizeFileNameWithExtension } from '../utils/files';
import { toMediaDto } from './serializers';
import { notFound, unsupported } from '../middleware/error-handler';
import { AppError } from '../middleware/error-handler';
import type { MediaDto } from '../types';

export async function analyzeMediaUrl(url: string): Promise<MediaDto> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new AppError(400, 'INVALID_URL', 'Enter a valid URL including https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(400, 'UNSUPPORTED_PROTOCOL', 'Only http and https URLs are supported.');
  }

  const provider = resolveProvider(url);

  if (provider.id !== 'youtube') {
    // Fail fast on SSRF before any network activity.
    await assertSafeUrl(url);
  }

  const analyzed = await provider.analyze(url);
  const media = await prisma.media.create({ data: analyzed });
  return toMediaDto(media);
}

export interface UploadRegistration {
  filePath: string;
  originalName: string;
  mimeType: string | null;
  size: number;
}

export async function registerUploadedMedia(input: UploadRegistration): Promise<MediaDto> {
  try {
    const probe = await probeMedia(input.filePath);
    if (!probe.hasAudio && !probe.hasVideo) {
      throw unsupported('The uploaded file has no audio or video stream.');
    }
    const safeOriginal = sanitizeBaseName(input.originalName, 'uploaded-media');
    const displayName = sanitizeFileNameWithExtension(input.originalName, 'uploaded-media');
    const title = sanitizeBaseName(probe.title || safeOriginal, 'Uploaded media');

    const media = await prisma.media.create({
      data: {
        sourceUrl: null,
        title,
        thumbnail: null,
        duration: probe.duration,
        sourceType: 'upload',
        provider: 'upload',
        mimeType: probe.mimeType,
        fileName: displayName,
        fileSize: input.size,
        width: probe.width,
        height: probe.height,
        hasAudio: probe.hasAudio,
        hasVideo: probe.hasVideo,
        storedPath: input.filePath,
      },
    });
    return toMediaDto(media);
  } catch (error) {
    await fs.unlink(input.filePath).catch(() => undefined);
    throw error;
  }
}

export async function getMediaById(id: string): Promise<MediaDto> {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw notFound('That media item no longer exists.', 'MEDIA_NOT_FOUND');
  return toMediaDto(media);
}

export async function getMediaRecord(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw notFound('That media item no longer exists.', 'MEDIA_NOT_FOUND');
  return media;
}
