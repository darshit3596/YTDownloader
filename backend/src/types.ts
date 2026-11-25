export type SourceType = 'direct_url' | 'upload' | 'youtube';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface OutputOption {
  format: 'mp3' | 'mp4';
  quality: string;
  label: string;
  description: string;
  available: boolean;
  reason?: string;
  estimatedSize?: number | null;
}

export interface MediaDto {
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

export interface JobMediaSummary {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  sourceType: SourceType;
  provider: string;
}

export interface JobDto {
  id: string;
  mediaId: string;
  outputFormat: 'mp3' | 'mp4';
  quality: string;
  status: JobStatus;
  progress: number;
  fileName: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  speed: number | null;
  etaSeconds: number | null;
  fileAvailable: boolean;
  downloadUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  media: JobMediaSummary | null;
}

export interface HistoryDto {
  id: string;
  fileName: string;
  format: string;
  fileSize: number | null;
  createdAt: string;
  jobId: string | null;
}

export interface QueueStats {
  active: number;
  queued: number;
  maxConcurrent: number;
}
