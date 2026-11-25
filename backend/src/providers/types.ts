import type { SourceType } from '../types';

export interface AnalyzedMedia {
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
  storedPath: string | null;
}

export interface MediaProvider {
  id: string;
  label: string;
  canHandle(url: string): boolean;
  analyze(url: string): Promise<AnalyzedMedia>;
}
