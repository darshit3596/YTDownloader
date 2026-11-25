import fs from 'node:fs';
import type { Job, Media } from '@prisma/client';
import type { HistoryDto, JobDto, MediaDto, SourceType } from '../types';
import { buildOutputOptions } from './output-options.service';
import { extractYouTubeId } from '../providers/youtube.provider';

export function toMediaDto(media: Media): MediaDto {
  const youtubeId =
    media.sourceType === 'youtube' && media.sourceUrl ? extractYouTubeId(media.sourceUrl) : null;

  return {
    id: media.id,
    sourceUrl: media.sourceUrl,
    title: media.title,
    thumbnail: media.thumbnail,
    duration: media.duration,
    sourceType: media.sourceType as SourceType,
    provider: media.provider,
    mimeType: media.mimeType,
    fileName: media.fileName,
    fileSize: media.fileSize,
    width: media.width,
    height: media.height,
    hasAudio: media.hasAudio,
    hasVideo: media.hasVideo,
    channel: media.channel,
    authorUrl: media.authorUrl,
    studioUrl: youtubeId ? `https://studio.youtube.com/video/${youtubeId}/edit` : null,
    outputOptions: buildOutputOptions(media),
    createdAt: media.createdAt.toISOString(),
  };
}

export function toJobDto(job: Job & { media?: Media | null }): JobDto {
  const fileAvailable = Boolean(
    job.status === 'completed' && job.outputPath && fs.existsSync(job.outputPath),
  );

  return {
    id: job.id,
    mediaId: job.mediaId,
    outputFormat: job.outputFormat as 'mp3' | 'mp4',
    quality: job.quality,
    status: job.status as JobDto['status'],
    progress: Math.round(job.progress * 10) / 10,
    fileName: job.fileName,
    fileSize: job.fileSize,
    errorMessage: job.errorMessage,
    speed: job.speed,
    etaSeconds: job.etaSeconds,
    fileAvailable,
    downloadUrl: fileAvailable ? `/api/downloads/${job.id}` : null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    media: job.media
      ? {
          title: job.media.title,
          thumbnail: job.media.thumbnail,
          duration: job.media.duration,
          sourceType: job.media.sourceType as SourceType,
          provider: job.media.provider,
        }
      : null,
  };
}

export function toHistoryDto(entry: {
  id: string;
  fileName: string;
  format: string;
  fileSize: number | null;
  createdAt: Date;
  jobId: string | null;
}): HistoryDto {
  return {
    id: entry.id,
    fileName: entry.fileName,
    format: entry.format,
    fileSize: entry.fileSize,
    createdAt: entry.createdAt.toISOString(),
    jobId: entry.jobId,
  };
}
