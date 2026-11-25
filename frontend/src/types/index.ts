export type SourceType = 'direct_url' | 'youtube' | 'upload';
export type OutputFormat = 'mp3' | 'mp4';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type AudioQuality = '128' | '192' | '256' | '320';
export type VideoQuality = '360' | '480' | '720' | '1080' | '4k';

export interface OutputOption {
  format: OutputFormat;
  quality: string;
  label: string;
  description: string;
  available: boolean;
  reason?: string;
  estimatedSize?: number | null;
}

export interface MediaItem {
  id: string;
  sourceUrl: string | null;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  sourceType: SourceType;
  provider: string;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  channel: string | null;
  authorUrl: string | null;
  studioUrl: string | null;
  outputOptions: OutputOption[];
  createdAt: string;
}

export interface Job {
  id: string;
  mediaId: string;
  outputFormat: OutputFormat;
  quality: string;
  status: JobStatus;
  progress: number;
  outputPath: string | null;
  fileName: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  speed: number | null;
  etaSeconds: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  downloadUrl: string | null;
  fileAvailable?: boolean;
  media?: Pick<MediaItem, 'title' | 'thumbnail' | 'duration' | 'sourceType' | 'provider'> | null;
}

export interface HistoryEntry {
  id: string;
  fileName: string;
  format: string;
  fileSize: number | null;
  createdAt: string;
  jobId: string | null;
}

export interface AppSettings {
  ffmpegPath: string;
  downloadDir?: string;
  maxConcurrentJobs: number;
  autoCleanupHours: number;
  keepOriginalUploads: boolean;
  defaultAudioQuality: AudioQuality;
  defaultVideoQuality: VideoQuality;
  theme: 'dark' | 'light';
}

export interface SystemStatus {
  ok: boolean;
  ffmpeg: { available: boolean; version: string | null; path: string | null };
  ffprobe: { available: boolean; version: string | null };
  youtubeApi: { configured: boolean };
  queue: { active: number; queued: number; maxConcurrent: number };
  storage: { uploads: number; downloads: number; temp: number };
  version: string;
}

export interface QueueStats {
  active: number;
  queued: number;
  maxConcurrent: number;
}
