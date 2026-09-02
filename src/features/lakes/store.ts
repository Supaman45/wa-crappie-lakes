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

export type SortKey = 'name' | 'acres' | 'dist' | 'catches' | 'visits';

interface LakesState {
  q: string;
  county: string;
  sort: SortKey;
  species: string;
  cat: string;
  flags: { fav: boolean; wish: boolean; ramp: boolean; motor: boolean; visited: boolean; caught: boolean; crew: boolean };
  launches: Record<string, Launch>;
  launchStatus: string;
  launchList: Launch[];
  setQ: (q: string) => void;
  setCounty: (c: string) => void;
  setSort: (s: SortKey) => void;
  setSpecies: (s: string) => void;
  setCat: (c: string) => void;
  toggleFlag: (k: keyof LakesState['flags']) => void;
  loadLaunches: () => Promise<void>;
}

export const useLakes = create<LakesState>((set, get) => ({
  q: '', county: '', sort: 'name', species: '', cat: '',
  flags: { fav: false, wish: false, ramp: false, motor: false, visited: false, caught: false, crew: false },
  launches: {}, launchStatus: 'Loading WDFW launches...', launchList: [],
  setQ: (q) => set({ q }),
  setCounty: (county) => set({ county }),
  setSort: (sort) => set({ sort }),
  setSpecies: (species) => set({ species }),
  setCat: (cat) => set({ cat }),
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
  let out = LAKES.filter(l => {
    if (q && !l.name.toLowerCase().includes(q) && !l.counties.some(c => c.toLowerCase().includes(q))) return false;
    if (s.county && !l.counties.includes(s.county)) return false;
    if (s.species && !l.sp.includes(s.species as Lake['sp'][number])) return false;
    const tag = me ? d.tags[tagKey(me, l.slug)] : undefined;
    if (s.cat && tag?.cat !== s.cat) return false;
    const f = s.flags; const st = d.index[l.slug];
    if (f.fav && !tag?.fav) return false;
    if (f.wish && !tag?.wish) return false;
    if (f.ramp && !s.launches[l.slug]) return false;
    if (f.motor && !s.launches[l.slug]?.motor) return false;
    if (f.visited && !(st?.visits)) return false;
    if (f.caught && !(st?.catches)) return false;
    if (f.crew && !Object.values(d.tags).some(t => t.lake_id === l.slug && t.user_id !== me && (t.fav || t.cat))) return false;
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
