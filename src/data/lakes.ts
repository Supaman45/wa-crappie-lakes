import raw from './lakes.json';
import rawOr from './lakes-or.json';
import type { Lake, SpeciesId } from '@/lib/types';

/**
 * Compact row. lakes.json is built from the WDFW FishWA lowland and high lakes layers; lakes-or.json
 * comes from ODFW Fish Habitat Distribution via scripts/fetch-oregon-lakes.mjs (st: 'OR').
 */
interface RawLake { n: string; s: string; a: number | null; e: number; c: string[]; y: number; x: number; p: string[]; k: 'L' | 'H'; m: string; w: number; r?: 0 | 1; h?: 'g' | 'n'; st?: 'OR'; o?: number }

const MGMT: Record<string, string> = { T: 'Trout emphasis', MT: 'Mixed species - Trout emphasis', MW: 'Mixed species - Warmwater emphasis', W: 'Warmwater emphasis', S: 'Fish Stocking', O: 'Overabundant Lakes', G: 'Getting Started Lakes' };

/** Oregon counties carry an "OR" tag: Douglas, Grant, Jefferson, Lincoln and Columbia exist in both states. */
export const orCounty = (c: string): string => `${c} OR`;

export const LAKES: Lake[] = [...(raw as RawLake[]), ...(rawOr as RawLake[])].map((l, i) => ({
  id: i,
  name: l.n,
  slug: l.s,
  acres: l.a,
  elev: l.e,
  counties: l.st === 'OR' ? l.c.map(orCounty) : l.c,
  lat: l.y,
  lng: l.x,
  sp: l.p as SpeciesId[],
  kind: l.k === 'H' ? 'high' : 'lowland',
  ramp: l.k === 'H' ? false : l.r === 1 ? true : l.r === 0 ? false : null,
  shore: l.h === 'g' ? 'good' : l.h === 'n' ? 'none' : null,
  mgmt: MGMT[l.m] || '',
  wdfw: l.w,
  state: l.st === 'OR' ? 'OR' : 'WA',
}));
export const WA_LAKES: Lake[] = LAKES.filter(l => l.state === 'WA');
export const LOWLAND_LAKES: Lake[] = LAKES.filter(l => l.kind === 'lowland');
export const LAKE_BY_SLUG: Record<string, Lake> = Object.fromEntries(LAKES.map(l => [l.slug, l]));
const countiesOf = (st: 'WA' | 'OR') => Array.from(new Set(LAKES.filter(l => l.state === st).flatMap(l => l.counties))).sort();
export const COUNTIES_WA: string[] = countiesOf('WA');
export const COUNTIES_OR: string[] = countiesOf('OR');
export const COUNTIES: string[] = [...COUNTIES_WA, ...COUNTIES_OR];
