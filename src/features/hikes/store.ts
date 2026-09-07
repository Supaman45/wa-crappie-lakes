import { create } from 'zustand';
import { trailsInBox, type Trail, type BBox } from '@/api/trails';
import { LAKES } from '@/data/lakes';
import { pairHikes, lakesInBox, type Hike } from '@/domain/hikes';

export const TRAIL_MIN_ZOOM = 12;

interface HikesState {
  // map viewport trails (Lakes mode, zoom >= TRAIL_MIN_ZOOM)
  showTrails: boolean;
  viewTrails: Trail[];
  viewHikes: Hike[];
  viewLoading: boolean;
  viewError: string | null;
  // origin-area hikes for the Plan tab
  areaKey: string | null;
  areaHikes: Hike[];
  areaLoading: boolean;
  areaError: string | null;
  setShowTrails: (v: boolean) => void;
  loadView: (bbox: BBox) => Promise<void>;
  loadArea: (lat: number, lng: number) => Promise<void>;
}

let viewCtrl: AbortController | null = null;
let areaCtrl: AbortController | null = null;

export const useHikes = create<HikesState>((set, get) => ({
  showTrails: true,
  viewTrails: [], viewHikes: [], viewLoading: false, viewError: null,
  areaKey: null, areaHikes: [], areaLoading: false, areaError: null,
  setShowTrails: (showTrails) => set({ showTrails }),
  loadView: async (bbox) => {
    if (viewCtrl) viewCtrl.abort();
    viewCtrl = new AbortController();
    const signal = viewCtrl.signal;
    set({ viewLoading: true, viewError: null });
    try {
      const pad = 0.01;
      const b: BBox = [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
      const trails = await trailsInBox(b, signal);
      if (signal.aborted) return;
      set({ viewTrails: trails, viewHikes: pairHikes(trails, lakesInBox(LAKES, [b[0] - 0.05, b[1] - 0.05, b[2] + 0.05, b[3] + 0.05])), viewLoading: false });
    } catch (e) {
      if (signal.aborted) return;
      set({ viewLoading: false, viewError: (e as Error).message || 'Could not load trails' });
    }
  },
  loadArea: async (lat, lng) => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (get().areaKey === key && (get().areaHikes.length || get().areaLoading)) return;
    if (areaCtrl) areaCtrl.abort();
    areaCtrl = new AbortController();
    const signal = areaCtrl.signal;
    set({ areaKey: key, areaLoading: true, areaError: null, areaHikes: [] });
    try {
      // about 40 miles north to south, 35 east to west
      const b: BBox = [lng - 0.42, lat - 0.3, lng + 0.42, lat + 0.3];
      const trails = await trailsInBox(b, signal);
      if (signal.aborted) return;
      set({ areaHikes: pairHikes(trails, lakesInBox(LAKES, b)), areaLoading: false });
    } catch (e) {
      if (signal.aborted) return;
      set({ areaLoading: false, areaError: (e as Error).message || 'Could not load trails' });
    }
  },
}));
