import raw from './lakes.json';
import type { Lake, SpeciesId } from '@/lib/types';

interface RawLake { name: string; slug: string; acres: number | null; elev: number; counties: string[]; lat: number; lng: number; sp: string[]; }

export const LAKES: Lake[] = (raw as RawLake[]).map((l, i) => ({ ...l, id: i, sp: l.sp as SpeciesId[] }));
export const LAKE_BY_SLUG: Record<string, Lake> = Object.fromEntries(LAKES.map(l => [l.slug, l]));
export const COUNTIES: string[] = Array.from(new Set(LAKES.flatMap(l => l.counties))).sort();
