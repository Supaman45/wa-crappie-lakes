import raw from './lakes.json';
import type { Lake, SpeciesId } from '@/lib/types';

/** Compact row from lakes.json (built from the WDFW FishWA lowland and high lakes layers). */
interface RawLake { n: string; s: string; a: number | null; e: number; c: string[]; y: number; x: number; p: string[]; k: 'L' | 'H'; m: string; w: number; r?: 0 | 1; h?: 'g' | 'n'; }

const MGMT: Record<string, string> = { T: 'Trout emphasis', MT: 'Mixed species - Trout emphasis', MW: 'Mixed species - Warmwater emphasis', W: 'Warmwater emphasis', S: 'Fish Stocking', O: 'Overabundant Lakes', G: 'Getting Started Lakes' };

export const LAKES: Lake[] = (raw as RawLake[]).map((l, i) => ({
  id: i,
  name: l.n,
  slug: l.s,
  acres: l.a,
  elev: l.e,
  counties: l.c,
  lat: l.y,
  lng: l.x,
  sp: l.p as SpeciesId[],
  kind: l.k === 'H' ? 'high' : 'lowland',
  ramp: l.k === 'H' ? false : l.r === 1 ? true : l.r === 0 ? false : null,
  shore: l.h === 'g' ? 'good' : l.h === 'n' ? 'none' : null,
  mgmt: MGMT[l.m] || '',
  wdfw: l.w,
}));
export const LOWLAND_LAKES: Lake[] = LAKES.filter(l => l.kind === 'lowland');
export const LAKE_BY_SLUG: Record<string, Lake> = Object.fromEntries(LAKES.map(l => [l.slug, l]));
export const COUNTIES: string[] = Array.from(new Set(LAKES.flatMap(l => l.counties))).sort();
