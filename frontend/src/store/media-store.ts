import { create } from 'zustand';
import type { MediaItem } from '@/types';
import { api, getErrorMessage } from '@/services/api';

interface MediaState {
  media: MediaItem | null;
  analyzing: boolean;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  setMedia: (media: MediaItem | null) => void;
  analyze: (url: string) => Promise<MediaItem | null>;
  upload: (file: File) => Promise<MediaItem | null>;
  clear: () => void;
  clearError: () => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  media: null,
  analyzing: false,
  uploading: false,
  uploadProgress: 0,
  error: null,

  setMedia: (media) => set({ media, error: null }),

  analyze: async (url) => {
    set({ analyzing: true, error: null });
    try {
      const media = await api.analyze(url.trim());
      set({ media, analyzing: false });
      return media;
    } catch (error) {
      set({ analyzing: false, error: getErrorMessage(error) });
      return null;
    }
  },

  upload: async (file) => {
    set({ uploading: true, uploadProgress: 0, error: null });
    try {
      const media = await api.uploadMedia(file, (progress) => set({ uploadProgress: progress }));
      set({ media, uploading: false, uploadProgress: 100 });
      return media;
    } catch (error) {
      set({ uploading: false, uploadProgress: 0, error: getErrorMessage(error) });
      return null;
    }
  },

  clear: () => set({ media: null, error: null, analyzing: false, uploading: false, uploadProgress: 0 }),
  clearError: () => set({ error: null }),
}));
