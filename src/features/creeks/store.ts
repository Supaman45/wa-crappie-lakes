import { create } from 'zustand';
import type { BBox, StreamSeg, Barrier, AccessSite } from '@/api/wdfw';
import { streamsInBox, barriersInBox, accessInBox } from '@/api/wdfw';
import { gaugesInBox, type Gauge } from '@/api/usgs';
import { SPECIES } from '@/data/species';

export const CREEK_MIN_ZOOM = 11;

interface CreeksState {
  bbox: BBox | null;
  zoom: number;
  streams: StreamSeg[];
  barriers: Barrier[];
  gauges: Gauge[];
  access: AccessSite[];
  loading: boolean;
  error: string | null;
  showBarriers: boolean;
  showGauges: boolean;
  showAccess: boolean;
  onlyDocumented: boolean;
  setViewport: (bbox: BBox, zoom: number) => void;
  load: (bbox: BBox, speciesIds: string[]) => Promise<void>;
  toggle: (k: 'showBarriers' | 'showGauges' | 'showAccess' | 'onlyDocumented') => void;
}

let ctrl: AbortController | null = null;

export function swifdNamesFor(ids: string[]): string[] {
  return SPECIES.filter(s => ids.includes(s.id)).flatMap(s => s.swifd || []);
}

export const useCreeks = create<CreeksState>((set, get) => ({
  bbox: null, zoom: 7, streams: [], barriers: [], gauges: [], access: [], loading: false, error: null,
  showBarriers: true, showGauges: true, showAccess: true, onlyDocumented: false,
  setViewport: (bbox, zoom) => set({ bbox, zoom }),
  toggle: (k) => set({ [k]: !get()[k] } as Partial<CreeksState>),
  load: async (bbox, speciesIds) => {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    set({ loading: true, error: null });
    try {
      const names = swifdNamesFor(speciesIds);
      // Pad the bbox a little so panning a short distance reuses the cache.
      const pad = 0.02;
      const b: BBox = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
      const [streams, barriers, gauges, access] = await Promise.all([
        streamsInBox(b, names, signal),
        barriersInBox(b, signal).catch(() => [] as Barrier[]),
        gaugesInBox(b, signal).catch(() => [] as Gauge[]),
        accessInBox(b, signal).catch(() => [] as AccessSite[]),
      ]);
      if (signal.aborted) return;
      set({ streams, barriers, gauges, access, loading: false });
    } catch (e) {
      if (signal.aborted) return;
      set({ loading: false, error: (e as Error).message || 'Could not load stream data' });
    }
  },
}));
