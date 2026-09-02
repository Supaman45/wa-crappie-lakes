import { kvGet, kvSet } from '@/lib/db';

/**
 * Same-origin serverless feeds (see /api). Each one scrapes a WDFW page the browser cannot
 * read directly and returns JSON. Results are cached in IndexedDB so the app works at the water.
 */

export interface Rule {
  id: string;
  title: string;
  link: string;
  published: string | null;
  kind: 'open' | 'close' | 'change';
  water: 'salt' | 'lake' | 'river' | 'other';
  action: string;
  effective: string;
  species: string;
  location: string;
  rules: string;
  reason: string;
  counties: string[];
  text: string;
}

export interface Plant {
  lake: string;
  lake_raw: string;
  county: string;
  region: number | null;
  date: string;      // YYYY-MM-DD
  species: string;
  number: number;
  fish_per_lb: number | null;
  hatchery: string;
  notes: string;
}

export interface EscapementRow {
  facility: string;
  stock: string;
  origin: 'hatchery' | 'wild' | 'mixed' | 'unknown' | null;
  date: string | null;
  comments: string;
  adult_total: number | null;
  jack_total: number | null;
  eggtake: number | null;
  on_hand_adults: number | null;
  on_hand_jacks: number | null;
  lethal_spawned: number | null;
  live_spawned: number | null;
  released: number | null;
  live_shipped: number | null;
  mortality: number | null;
  surplus: number | null;
  prev_adult_total: number | null;
  delta: number | null;
}

export interface Escapement {
  fetched: string;
  latest: { reportDate: string | null; url: string; fileDate: string; species: { species: string; rows: EscapementRow[] }[] };
  previous: { fileDate: string; reportDate: string | null; url: string } | null;
}

const RULES_TTL = 30 * 60 * 1000;
const PLANTS_TTL = 60 * 60 * 1000;
const ESC_TTL = 6 * 60 * 60 * 1000;

async function getJson<T>(path: string, key: string, ttl: number, signal?: AbortSignal): Promise<T> {
  const cached = await kvGet<T>(key, ttl);
  if (cached) return cached;
  const res = await fetch(path, { signal });
  if (!res.ok) {
    const stale = await kvGet<T>(key);
    if (stale) return stale;
    throw new Error(`feed ${res.status}`);
  }
  const j = await res.json() as T;
  kvSet(key, j);
  return j;
}

export async function fetchRules(signal?: AbortSignal): Promise<Rule[]> {
  const j = await getJson<{ items: Rule[] }>('/api/rules', 'feed:rules', RULES_TTL, signal);
  return j.items || [];
}

/** Recent trout plants statewide (WDFW lists the last few weeks). */
export async function fetchPlants(signal?: AbortSignal): Promise<Plant[]> {
  const j = await getJson<{ rows: Plant[] }>('/api/plants', 'feed:plants', PLANTS_TTL, signal);
  return j.rows || [];
}

export async function fetchEscapement(signal?: AbortSignal): Promise<Escapement> {
  return getJson<Escapement>('/api/escapement', 'feed:escapement', ESC_TTL, signal);
}

/* ---------- matching helpers ---------- */

const STOP = new Set(['lake', 'lk', 'res', 'reservoir', 'pond', 'river', 'creek', 'cr', 'the', 'of', 'and', 'north', 'south', 'east', 'west', 'fork', 'nf', 'sf', 'ef', 'wf', 'upper', 'lower', 'little', 'big']);

/** Significant words of a water name, lower case, for loose matching. */
export function nameTokens(name: string): string[] {
  return name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

/** True when every significant word of `name` appears in `text` as a whole word. */
export function mentions(text: string, name: string): boolean {
  const toks = nameTokens(name);
  if (!toks.length) return false;
  const t = text.toLowerCase();
  return toks.every(w => new RegExp(`\\b${w}\\b`).test(t));
}

/** Emergency rules that name this water (title or location) and, when given, one of its counties. */
export function rulesFor(rules: Rule[], name: string, counties: string[] = []): Rule[] {
  return rules.filter(r => {
    const hay = `${r.title} ${r.location}`;
    if (!mentions(hay, name)) return false;
    if (counties.length && r.counties.length && !r.counties.some(c => counties.includes(c))) return false;
    return true;
  });
}

/** Trout plants for a lake, matched on name words and county. */
export function plantsFor(plants: Plant[], name: string, counties: string[] = []): Plant[] {
  const toks = nameTokens(name);
  if (!toks.length) return [];
  return plants.filter(p => {
    const pt = nameTokens(p.lake);
    if (!toks.every(w => pt.includes(w))) return false;
    if (counties.length && p.county && !counties.some(c => c.toLowerCase() === p.county.toLowerCase())) return false;
    return true;
  });
}

export function daysAgo(iso: string): number {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}
