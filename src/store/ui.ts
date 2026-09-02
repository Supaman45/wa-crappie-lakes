import { create } from 'zustand';
import type { Lake, Spot, Catch } from '@/lib/types';
import { lsGet, lsSet } from '@/lib/util';

export type Tab = 'lakes' | 'creeks' | 'plan' | 'log' | 'more';
export type MapMode = 'lakes' | 'creeks';

export interface StreamPick {
  llid: string;
  name: string;
  lat: number;
  lng: number;
  species: { species: string; swifd: string; dist: string; use: string; run: string; miles: number }[];
  totalMiles: number;
}

export interface Origin { lat: number; lng: number; label: string; }

interface UIState {
  tab: Tab;
  mobileView: 'panel' | 'map';
  mapMode: MapMode;
  origin: Origin | null;
  activeLakeId: number | null;
  sheet: null | { kind: 'lake'; lake: Lake } | { kind: 'catch'; lakeId: string; lakeName: string; waterType: Catch['water_type']; spotId?: string | null } | { kind: 'catchView'; catchId: string } | { kind: 'stream'; pick: StreamPick } | { kind: 'spot'; spot: Spot } | { kind: 'profile' } | { kind: 'trip'; tripId: string };
  flyTo: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  creekSpecies: string[];
  setTab: (t: Tab) => void;
  setMobileView: (v: 'panel' | 'map') => void;
  setMapMode: (m: MapMode) => void;
  setOrigin: (o: Origin | null) => void;
  setActiveLake: (id: number | null) => void;
  openSheet: (s: UIState['sheet']) => void;
  closeSheet: () => void;
  fly: (lat: number, lng: number, zoom?: number) => void;
  setCreekSpecies: (s: string[]) => void;
}

const savedSpecies = (() => { try { const v = lsGet('wff-creek-species'); return v ? JSON.parse(v) as string[] : null; } catch { return null; } })();

export const useUI = create<UIState>((set) => ({
  tab: 'lakes',
  mobileView: 'panel',
  mapMode: 'lakes',
  origin: null,
  activeLakeId: null,
  sheet: null,
  flyTo: null,
  creekSpecies: savedSpecies || ['cutthroat', 'rainbow', 'coho', 'steelhead'],
  setTab: (tab) => set(s => ({ tab, mapMode: tab === 'creeks' ? 'creeks' : (tab === 'lakes' || tab === 'plan') ? 'lakes' : s.mapMode })),
  setMobileView: (mobileView) => set({ mobileView }),
  setMapMode: (mapMode) => set({ mapMode }),
  setOrigin: (origin) => set({ origin }),
  setActiveLake: (activeLakeId) => set({ activeLakeId }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  fly: (lat, lng, zoom) => set({ flyTo: { lat, lng, zoom, nonce: Date.now() }, mobileView: 'map' }),
  setCreekSpecies: (creekSpecies) => { lsSet('wff-creek-species', JSON.stringify(creekSpecies)); set({ creekSpecies }); },
}));
