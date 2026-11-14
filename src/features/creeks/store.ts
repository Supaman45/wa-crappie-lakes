import { create } from 'zustand';
import type { BBox, StreamSeg, Barrier, AccessSite } from '@/api/wdfw';
import { streamsInBox, barriersInBox, accessInBox } from '@/api/wdfw';
import { gaugesInBox, type Gauge } from '@/api/usgs';
import { SPECIES } from '@/data/species';

export const CREEK_MIN_ZOOM = 11;

/** What the Creeks list is showing: a radius around a place, or whatever the map has in view. */
export type CreekScope = { kind: 'area'; lat: number; lng: number; mi: number; label: string } | { kind: 'map' };

/** A lat/lng box roughly `mi` miles out from a point. */
export function boxAround(lat: number, lng: number, mi: number): BBox {
  const dLat = mi / 69;
  const dLng = mi / (69 * Math.cos(lat * Math.PI / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

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
  scope: CreekScope | null;
  key: string | null;
  setViewport: (bbox: BBox, zoom: number) => void;
  load: (bbox: BBox, speciesIds: string[]) => Promise<void>;
  loadArea: (lat: number, lng: number, mi: number, label: string, speciesIds: string[]) => Promise<void>;
  toggle: (k: 'showBarriers' | 'showGauges' | 'showAccess' | 'onlyDocumented') => void;
}

let ctrl: AbortController | null = null;

export function swifdNamesFor(ids: string[]): string[] {
  return SPECIES.filter(s => ids.includes(s.id)).flatMap(s => s.swifd || []);
}

export const useCreeks = create<CreeksState>((set, get) => ({
  bbox: null, zoom: 7, streams: [], barriers: [], gauges: [], access: [], loading: false, error: null,
  showBarriers: true, showGauges: true, showAccess: true, onlyDocumented: false,
  scope: null, key: null,
  // Only the visible map calls this, so a viewport report means the list now follows the map.
  setViewport: (bbox, zoom) => set({ bbox, zoom, scope: { kind: 'map' } }),
  loadArea: async (lat, lng, mi, label, speciesIds) => {
    const bbox = boxAround(lat, lng, mi);
    set({ bbox, zoom: CREEK_MIN_ZOOM + 1, scope: { kind: 'area', lat, lng, mi, label } });
    await get().load(bbox, speciesIds);
  },
  toggle: (k) => set({ [k]: !get()[k] } as Partial<CreeksState>),
  load: async (bbox, speciesIds) => {
    // The list and the map can ask for the same box back to back. Fetch it once.
    const key = `${bbox.map(n => n.toFixed(3)).join(',')}|${[...speciesIds].sort().join(',')}`;
    if (key === get().key && !get().error) return;
    set({ key });
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
      set({ loading: false, key: null, error: (e as Error).message || 'Could not load stream data' });
    }
  },
}));
