import { create } from 'zustand';
import type { AppSettings } from '@/types';
import { api } from '@/services/api';

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  fetchSettings: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const settings = await api.settings();
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  setSettings: (settings) => set({ settings }),
}));
