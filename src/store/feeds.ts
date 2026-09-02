import { create } from 'zustand';
import { fetchRules, fetchPlants, fetchEscapement, type Rule, type Plant, type Escapement } from '@/api/feeds';

type Status = 'idle' | 'loading' | 'ok' | 'err';

interface FeedsState {
  rules: Rule[];
  rulesStatus: Status;
  plants: Plant[];
  plantsStatus: Status;
  escapement: Escapement | null;
  escStatus: Status;
  loadRules: () => Promise<void>;
  loadPlants: () => Promise<void>;
  loadEscapement: () => Promise<void>;
  loadAll: () => void;
}

/** WDFW feeds shared by several panels. Each loads once per session and is cached in IndexedDB. */
export const useFeeds = create<FeedsState>((set, get) => ({
  rules: [], rulesStatus: 'idle',
  plants: [], plantsStatus: 'idle',
  escapement: null, escStatus: 'idle',
  loadRules: async () => {
    if (get().rulesStatus === 'loading') return;
    set({ rulesStatus: 'loading' });
    try { set({ rules: await fetchRules(), rulesStatus: 'ok' }); } catch { set({ rulesStatus: 'err' }); }
  },
  loadPlants: async () => {
    if (get().plantsStatus === 'loading') return;
    set({ plantsStatus: 'loading' });
    try { set({ plants: await fetchPlants(), plantsStatus: 'ok' }); } catch { set({ plantsStatus: 'err' }); }
  },
  loadEscapement: async () => {
    if (get().escStatus === 'loading') return;
    set({ escStatus: 'loading' });
    try { set({ escapement: await fetchEscapement(), escStatus: 'ok' }); } catch { set({ escStatus: 'err' }); }
  },
  loadAll: () => {
    const s = get();
    if (s.rulesStatus === 'idle') s.loadRules();
    if (s.plantsStatus === 'idle') s.loadPlants();
    if (s.escStatus === 'idle') s.loadEscapement();
  },
}));
