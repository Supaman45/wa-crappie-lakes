import { create } from 'zustand';
import { lsGet, lsSet } from '@/lib/util';
import type { Conditions, WaterType } from '@/lib/types';

const KEY = 'wff-active-trip';

/**
 * The trip you are on right now.
 *
 * It lives in localStorage rather than the database because a trip is worthless until it ends,
 * the phone is usually out of signal while it runs, and a half-written row syncing to the crew
 * mid-morning helps nobody. On End it is written once through the normal saveTrip path, so the
 * offline outbox handles it like everything else.
 *
 * A trip that is still open the next day is stale: the app offers to close it at the last catch
 * rather than recording an eighteen hour session.
 */
export interface ActiveTrip {
  id: string;
  startedAt: string;
  waterId: string;
  waterName: string;
  waterType: WaterType;
  spotId: string | null;
  catchIds: string[];
  cond: Conditions | null;
  note: string;
}

interface TripState {
  active: ActiveTrip | null;
  start: (t: Omit<ActiveTrip, 'catchIds' | 'startedAt' | 'note'> & { startedAt?: string }) => void;
  attach: (catchId: string) => void;
  detach: (catchId: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
  /** Hours the trip has been running. */
  hours: () => number;
  /** True when the trip started on an earlier day and was never closed. */
  stale: () => boolean;
}

function read(): ActiveTrip | null {
  try {
    const raw = lsGet(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as ActiveTrip;
    return t && t.id && t.startedAt ? { ...t, catchIds: t.catchIds || [] } : null;
  } catch { return null; }
}

function write(t: ActiveTrip | null) {
  try { if (t) lsSet(KEY, JSON.stringify(t)); else lsSet(KEY, ''); } catch { /* private mode */ }
}

export const useTrip = create<TripState>((set, get) => ({
  active: read(),
  start: (t) => {
    const active: ActiveTrip = { ...t, startedAt: t.startedAt || new Date().toISOString(), catchIds: [], note: '' };
    write(active);
    set({ active });
  },
  attach: (catchId) => {
    const a = get().active;
    if (!a || a.catchIds.includes(catchId)) return;
    const next = { ...a, catchIds: [...a.catchIds, catchId] };
    write(next);
    set({ active: next });
  },
  detach: (catchId) => {
    const a = get().active;
    if (!a) return;
    const next = { ...a, catchIds: a.catchIds.filter(x => x !== catchId) };
    write(next);
    set({ active: next });
  },
  setNote: (note) => {
    const a = get().active;
    if (!a) return;
    const next = { ...a, note };
    write(next);
    set({ active: next });
  },
  clear: () => { write(null); set({ active: null }); },
  hours: () => {
    const a = get().active;
    return a ? (Date.now() - new Date(a.startedAt).getTime()) / 3600000 : 0;
  },
  stale: () => {
    const a = get().active;
    if (!a) return false;
    const s = new Date(a.startedAt);
    const now = new Date();
    return s.toDateString() !== now.toDateString();
  },
}));

export function tripMinutes(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
}

export function fmtDuration(min: number): string {
  if (min < 1) return 'just started';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
