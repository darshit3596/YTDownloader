import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type { Job, QueueStats } from '@/types';
import { api } from '@/services/api';
import { toast } from './toast-store';
import { useHistoryStore } from './history-store';

interface JobState {
  jobs: Job[];
  queue: QueueStats | null;
  loading: boolean;
  connected: boolean;
  error: string | null;
  socket: Socket | null;
  fetchJobs: () => Promise<void>;
  upsertJob: (job: Job) => void;
  removeJob: (id: string) => void;
  setQueue: (queue: QueueStats) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

function sortJobs(jobs: Job[]): Job[] {
  const weight: Record<Job['status'], number> = {
    processing: 0,
    queued: 1,
    failed: 2,
    cancelled: 3,
    completed: 4,
  };
  return [...jobs].sort((a, b) => {
    const diff = weight[a.status] - weight[b.status];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ??
  (API_BASE.replace(/\/api\/?$/, '') || '/');

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  queue: null,
  loading: false,
  connected: false,
  error: null,
  socket: null,

  fetchJobs: async () => {
    set({ loading: get().jobs.length === 0 });
    try {
      const jobs = await api.listJobs();
      set({ jobs: sortJobs(jobs), loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  upsertJob: (job) =>
    set((state) => {
      const exists = state.jobs.some((j) => j.id === job.id);
      if (!exists && job.status === 'completed') {
        // Still surface finished jobs created elsewhere, no toast noise.
      }
      const next = exists
        ? state.jobs.map((j) => (j.id === job.id ? { ...j, ...job } : j))
        : [job, ...state.jobs];
      return { jobs: sortJobs(next) };
    }),

  removeJob: (id) => set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),

  setQueue: (queue) => set({ queue }),

  connectSocket: () => {
    if (get().socket) return;
    const socket = io(SOCKET_URL || '/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1200,
    });
    set({ socket });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('connect_error', () => set({ connected: false }));

    socket.on('job:update', (job: Job) => {
      get().upsertJob(job);
      if (job.status === 'completed') {
        useHistoryStore.getState().recordCompletedJob(job);
        toast.success('Conversion complete', `${job.fileName ?? 'Your file'} is ready to download.`);
      } else if (job.status === 'failed') {
        toast.error('Conversion failed', job.errorMessage ?? 'The job could not be completed.');
      }
    });

    socket.on('job:created', (job: Job) => get().upsertJob(job));
    socket.on('queue:stats', (stats: QueueStats) => set({ queue: stats }));
  },

  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },
}));
