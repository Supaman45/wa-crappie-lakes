import { create } from 'zustand';
import type { Lake, Launch } from '@/lib/types';
import { LAKES } from '@/data/lakes';
import { haversine } from '@/lib/util';
import { loadLaunches } from '@/api/wdfw';
import { matchLaunches } from '@/domain/launchMatch';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { currentUserId } from '@/store/data';
import { tagKey } from '@/lib/db';
import { useFeeds } from '@/store/feeds';
import { plantsFor } from '@/api/feeds';
import { boatFit } from '@/domain/boatFit';

export type SortKey = 'name' | 'acres' | 'dist' | 'catches' | 'visits';
export type SizeKey = '' | 'small' | 'mid' | 'big';

interface LakesState {
  q: string;
  county: string;
  sort: SortKey;
  species: string;
  cat: string;
  size: SizeKey;
  flags: { fav: boolean; wish: boolean; ramp: boolean; motor: boolean; visited: boolean; caught: boolean; crew: boolean; stocked: boolean; bigBoat: boolean; smallBoat: boolean; high: boolean };
  launches: Record<string, Launch>;
  launchStatus: string;
  launchList: Launch[];
  setQ: (q: string) => void;
  setCounty: (c: string) => void;
  setSort: (s: SortKey) => void;
  setSpecies: (s: string) => void;
  setCat: (c: string) => void;
  setSize: (k: SizeKey) => void;
  toggleFlag: (k: keyof LakesState['flags']) => void;
  loadLaunches: () => Promise<void>;
}

export const useLakes = create<LakesState>((set, get) => ({
  q: '', county: '', sort: 'name', species: '', cat: '', size: '',
  flags: { fav: false, wish: false, ramp: false, motor: false, visited: false, caught: false, crew: false, stocked: false, bigBoat: false, smallBoat: false, high: false },
  launches: {}, launchStatus: 'Loading WDFW launches...', launchList: [],
  setQ: (q) => set({ q }),
  setCounty: (county) => set({ county }),
  setSort: (sort) => set({ sort }),
  setSpecies: (species) => set({ species }),
  setCat: (cat) => set({ cat }),
  setSize: (size) => set({ size }),
  toggleFlag: (k) => set({ flags: { ...get().flags, [k]: !get().flags[k] } }),
  loadLaunches: async () => {
    try {
      const list = await loadLaunches();
      const launches = matchLaunches(LAKES, list);
      set({ launches, launchList: list, launchStatus: `${Object.keys(launches).length} of ${LAKES.length} lakes matched to a WDFW boat launch.` });
    } catch { set({ launchStatus: 'Live WDFW launch data could not load. Directions use lake centers.' }); }
  },
}));

export function lakeDistance(l: Lake): number | null {
  const o = useUI.getState().origin; if (!o) return null;
  return haversine(o.lat, o.lng, l.lat, l.lng);
}

/** Filtered + sorted lakes, computed from the three stores. Call inside a selector-driven component. */
export function filterLakes(): Lake[] {
  const s = useLakes.getState();
  const d = useData.getState();
  const me = currentUserId();
  const origin = useUI.getState().origin;
  const q = s.q.trim().toLowerCase();
  const plants = s.flags.stocked ? useFeeds.getState().plants : null;
  let out = LAKES.filter(l => {
    if (q && !l.name.toLowerCase().includes(q) && !l.counties.some(c => c.toLowerCase().includes(q))) return false;
    if (s.county && !l.counties.includes(s.county)) return false;
    if (l.kind === 'high' && !s.flags.high) return false;
    if (s.size) { const a = l.acres || 0; if (s.size === 'small' ? a >= 25 : s.size === 'mid' ? (a < 25 || a >= 200) : a < 200) return false; }
    if (s.species && !l.sp.includes(s.species as Lake['sp'][number])) return false;
    const tag = me ? d.tags[tagKey(me, l.slug)] : undefined;
    if (s.cat && tag?.cat !== s.cat) return false;
    const f = s.flags; const st = d.index[l.slug];
    if (f.fav && !tag?.fav) return false;
    if (f.wish && !tag?.wish) return false;
    if (f.ramp && !s.launches[l.slug] && l.ramp !== true) return false;
    if (f.bigBoat && boatFit(l, s.launches[l.slug]).fit !== 'big') return false;
    if (f.smallBoat && !['big', 'small'].includes(boatFit(l, s.launches[l.slug]).fit)) return false;
    if (f.motor && !s.launches[l.slug]?.motor) return false;
    if (f.visited && !(st?.visits)) return false;
    if (f.caught && !(st?.catches)) return false;
    if (f.crew && !Object.values(d.tags).some(t => t.lake_id === l.slug && t.user_id !== me && (t.fav || t.cat))) return false;
    if (plants && !plantsFor(plants, l.name, l.counties).length) return false;
    return true;
  });
  const dist = (l: Lake) => origin ? haversine(origin.lat, origin.lng, l.lat, l.lng) : 1e9;
  const sortKey: SortKey = s.sort === 'dist' && !origin ? 'name' : s.sort;
  out = out.slice().sort((a, b) => {
    switch (sortKey) {
      case 'acres': return (b.acres || 0) - (a.acres || 0);
      case 'dist': return dist(a) - dist(b);
      case 'catches': return (d.index[b.slug]?.catches || 0) - (d.index[a.slug]?.catches || 0);
      case 'visits': return (d.index[b.slug]?.visits || 0) - (d.index[a.slug]?.visits || 0);
      default: return a.name.localeCompare(b.name);
    }
  });
  return out;
}
