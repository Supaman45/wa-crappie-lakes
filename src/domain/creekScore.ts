import type { Gauge } from '@/api/usgs';
import type { Barrier, AccessSite } from '@/api/wdfw';
import { haversine, cToF } from '@/lib/util';

export interface StreamSpeciesRow { species: string; swifd: string; dist: string; use: string; run: string; miles: number; }

export interface CreekScoreInput {
  rows: StreamSpeciesRow[];
  lat: number; lng: number;
  gauge: Gauge | null; gaugeDist: number | null;
  gaugeMedianCfs?: number | null;
  barriers: Barrier[];
  access: AccessSite[];
}
export interface CreekScore { score: number; why: string; parts: { label: string; pts: number; max: number }[]; }

const DOCUMENTED = /documented/i;

/**
 * Creek Score 0..99. Weights: fish evidence 35, cold water 20, barrier isolation 15, access 20, flow 10.
 * Every part is explainable in one line.
 */
export function creekScore(inp: CreekScoreInput): CreekScore {
  const parts: CreekScore['parts'] = [];
  const why: string[] = [];

  // Fish evidence
  const speciesSet = new Set(inp.rows.map(r => r.species).filter(s => s !== 'other'));
  const documented = inp.rows.filter(r => DOCUMENTED.test(r.dist));
  const spawnRear = documented.filter(r => /spawn|rear/i.test(r.use));
  let fish = Math.min(15, speciesSet.size * 5) + Math.min(12, documented.length * 3) + (spawnRear.length ? 8 : 0);
  fish = Math.min(35, fish);
  parts.push({ label: 'Fish evidence', pts: fish, max: 35 });
  if (spawnRear.length) why.push('documented spawning or rearing'); else if (documented.length) why.push('documented presence'); else if (inp.rows.length) why.push('presumed or modeled only');

  // Cold water
  let cold = 8;
  if (inp.gauge && inp.gauge.tempC != null && inp.gaugeDist != null && inp.gaugeDist < 15) {
    const f = cToF(inp.gauge.tempC);
    cold = f <= 58 ? 20 : f <= 64 ? 15 : f <= 68 ? 9 : 3;
    why.push(`${Math.round(f)}°F at the nearest gauge`);
  } else if (speciesSet.has('bull') || speciesSet.has('cutthroat')) { cold = 13; }
  parts.push({ label: 'Cold water', pts: cold, max: 20 });

  // Barrier isolation: a total or natural barrier within 2 miles downstream-ish means protected resident fish above it
  const near = inp.barriers.filter(b => haversine(inp.lat, inp.lng, b.lat, b.lng) <= 2);
  const total = near.filter(b => b.kind === 'total' || b.kind === 'natural');
  const iso = total.length ? 15 : near.some(b => b.kind === 'partial') ? 8 : 4;
  parts.push({ label: 'Isolation', pts: iso, max: 15 });
  if (total.length) why.push(`${total.length} full barrier${total.length > 1 ? 's' : ''} within 2 mi (resident fish above)`);

  // Access
  const acc = inp.access.map(a => haversine(inp.lat, inp.lng, a.lat, a.lng)).sort((a, b) => a - b)[0];
  const access = acc == null ? 5 : acc <= 1 ? 20 : acc <= 3 ? 14 : acc <= 6 ? 8 : 5;
  parts.push({ label: 'Access', pts: access, max: 20 });
  if (acc != null && acc <= 3) why.push(`public access ${acc.toFixed(1)} mi away`); else why.push('no mapped public access nearby');

  // Flow vs median
  let flow = 5;
  if (inp.gauge?.cfs != null && inp.gaugeMedianCfs) {
    const ratio = inp.gauge.cfs / inp.gaugeMedianCfs;
    flow = ratio >= 0.6 && ratio <= 1.6 ? 10 : ratio > 1.6 && ratio <= 2.5 ? 6 : ratio < 0.6 ? 6 : 2;
    if (ratio > 2.5) why.push('blown out'); else if (ratio < 0.6) why.push('low flow');
  }
  parts.push({ label: 'Flow', pts: flow, max: 10 });

  const score = Math.max(5, Math.min(99, parts.reduce((s, p) => s + p.pts, 0)));
  return { score, why: why.slice(0, 3).join(', ') || 'limited data', parts };
}
