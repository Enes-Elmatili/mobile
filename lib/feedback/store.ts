import { create } from 'zustand';
import type { ToastType, CelebrationKind } from './events';

export interface ToastItem { id: number; type: ToastType; message: string }
export interface CelebrationItem { kind: CelebrationKind; title: string }
export interface ConfirmItem {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

const TOAST_CAP = 3;
let nextId = 1;

interface FeedbackStoreState {
  toasts: ToastItem[];
  celebration: CelebrationItem | null;
  confirm: ConfirmItem | null;
  pushToast: (t: Omit<ToastItem, 'id'>) => number;
  dismissToast: (id: number) => void;
  setCelebration: (c: CelebrationItem) => void;
  clearCelebration: () => void;
  setConfirm: (c: ConfirmItem) => void;
  clearConfirm: () => void;
}

export const useFeedbackStore = create<FeedbackStoreState>((set) => ({
  toasts: [],
  celebration: null,
  confirm: null,

  pushToast: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-TOAST_CAP) }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setCelebration: (c) => set({ celebration: c }),
  clearCelebration: () => set({ celebration: null }),
  setConfirm: (c) => set({ confirm: c }),
  clearConfirm: () => set({ confirm: null }),
}));
