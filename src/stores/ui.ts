import { create } from 'zustand';

type ToastVariant = 'success' | 'warning' | 'danger' | 'info';
type Toast = { id: string; title?: string; message: string; variant?: ToastVariant };

type UIState = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'> & { duration?: number }) => void;
  dismissToast: (id: string) => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  // Tema único: escuro
  theme: 'dark',
  toggleTheme: () => set({ theme: 'dark' }),
  sidebarOpen: true,
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toasts: [],
  pushToast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { ...t, id }] });
    const ms = t.duration ?? 4000;
    if (ms > 0) {
      setTimeout(() => {
        const dismiss = get().dismissToast;
        dismiss(id);
      }, ms);
    }
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter(x => x.id !== id) })
}));