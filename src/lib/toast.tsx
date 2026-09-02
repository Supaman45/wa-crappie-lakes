import { create } from 'zustand';

interface ToastItem { id: number; text: string; kind: 'info' | 'warn' | 'err'; }
interface ToastState { items: ToastItem[]; push: (text: string, kind?: ToastItem['kind']) => void; remove: (id: number) => void; }

let seq = 1;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (text, kind = 'info') => {
    const id = seq++;
    set(s => ({ items: [...s.items.slice(-3), { id, text, kind }] }));
    setTimeout(() => set(s => ({ items: s.items.filter(i => i.id !== id) })), kind === 'err' ? 5000 : 3200);
  },
  remove: (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),
}));

/** Imperative helper usable outside React. */
export function toast(text: string, kind: ToastItem['kind'] = 'info'): void { useToasts.getState().push(text, kind); }

export function Toasts() {
  const items = useToasts(s => s.items);
  return (
    <div className="toasts" aria-live="polite">
      {items.map(t => <div key={t.id} className={`toast ${t.kind === 'info' ? '' : t.kind}`}>{t.text}</div>)}
    </div>
  );
}
