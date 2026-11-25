import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryEntry, Job } from '@/types';

interface HistoryState {
  entries: HistoryEntry[];
  recordCompletedJob: (job: Job) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      recordCompletedJob: (job) => {
        if (job.status !== 'completed') return;
        const exists = get().entries.some((e) => e.jobId === job.id);
        if (exists) return;

        const entry: HistoryEntry = {
          id: `hist-${job.id}`,
          fileName: job.fileName ?? job.media?.title ?? `download.${job.outputFormat}`,
          format: job.outputFormat,
          fileSize: job.fileSize,
          createdAt: job.completedAt ?? new Date().toISOString(),
          jobId: job.id,
        };
        set((state) => ({ entries: [entry, ...state.entries].slice(0, 200) }));
      },

      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((item) => item.id !== id) })),

      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'mediaflow-local-history',
    },
  ),
);
