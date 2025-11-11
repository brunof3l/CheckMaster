import { create } from 'zustand';

type UIState = { theme: 'light' | 'dark'; toggleTheme: () => void };
export const useUIStore = create<UIState>((set, get) => ({
  theme: 'light',
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' })
}));