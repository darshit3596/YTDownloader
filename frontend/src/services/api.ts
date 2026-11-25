import axios, { AxiosError } from 'axios';
import type {
  AppSettings,
  HistoryEntry,
  Job,
  MediaItem,
  QueueStats,
  SystemStatus,
} from '@/types';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  message?: string;
}

export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code = 'REQUEST_FAILED', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const body = axiosError.response?.data;
    const message =
      body?.error?.message ??
      body?.message ??
      (axiosError.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : axiosError.code === 'ERR_NETWORK'
          ? 'Cannot reach the MediaFlow API. Is the backend running?'
          : axiosError.message);
    return new ApiError(
      message || 'Request failed',
      body?.error?.code ?? 'REQUEST_FAILED',
      axiosError.response?.status,
    );
  }
  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError('Unexpected error');
}

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const { data } = await fn();
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const api = {
  health: () => request<{ ok: boolean; version: string }>(() => client.get('/health')),
  systemStatus: () => request<SystemStatus>(() => client.get('/system/status')),

  analyze: (url: string) =>
    request<MediaItem>(() => client.post('/media/analyze', { url }, { timeout: 45_000 })),

  getMedia: (id: string) => request<MediaItem>(() => client.get(`/media/${id}`)),

  uploadMedia: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return request<MediaItem>(() =>
      client.post('/media/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60_000,
        onUploadProgress: (event) => {
          if (!onProgress || !event.total) return;
          onProgress(Math.round((event.loaded / event.total) * 100));
        },
      }),
    );
  },

  createConversion: (payload: {
    mediaId: string;
    outputFormat: 'mp3' | 'mp4';
    quality: string;
    fileName?: string;
  }) => request<Job>(() => client.post('/conversions', payload)),

  directDownload: (payload: {
    url: string;
    outputFormat: 'mp3' | 'mp4';
    quality: string;
    fileName?: string;
  }) =>
    request<{ media: MediaItem; job: Job }>(() =>
      client.post('/direct-download', payload, { timeout: 60_000 }),
    ),

  listJobs: (limit = 50) => request<Job[]>(() => client.get('/jobs', { params: { limit } })),
  getJob: (id: string) => request<Job>(() => client.get(`/jobs/${id}`)),
  cancelJob: (id: string) => request<Job>(() => client.post(`/jobs/${id}/cancel`)),
  retryJob: (id: string) => request<Job>(() => client.post(`/jobs/${id}/retry`)),
  getQueue: () => request<QueueStats>(() => client.get('/jobs/queue/status')),

  history: (limit = 100) =>
    request<HistoryEntry[]>(() => client.get('/history', { params: { limit } })),
  deleteHistory: (id: string) => request<{ deleted: boolean }>(() => client.delete(`/history/${id}`)),
  clearHistory: () => request<{ deleted: number }>(() => client.delete('/history')),

  settings: () => request<AppSettings>(() => client.get('/settings')),
  updateSettings: (payload: Partial<AppSettings>) =>
    request<AppSettings>(() => client.put('/settings', payload)),

  downloadUrl: (jobId: string) => `${API_BASE_URL}/downloads/${jobId}`,
  streamUrl: (jobId: string) => `${API_BASE_URL}/downloads/${jobId}?inline=1`,
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
