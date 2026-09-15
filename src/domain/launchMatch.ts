import type { Lake, Launch } from '@/lib/types';
import { haversine } from '@/lib/util';
import { normName } from '@/api/wdfw';

function nameMatch(key: string, hay: string): boolean {
  if (!key) return false;
  if (key.length >= 4 && hay.includes(key)) return true;
  const t = key.split(' ').filter(x => x.length >= 3);
  return t.length > 0 && t.every(x => hay.includes(x));
}

/** Radius of a circle with this acreage, in miles. 640 acres to the square mile. */
function radiusMi(acres: number | null | undefined): number {
  return Math.sqrt(Math.max(acres || 0, 1) / (Math.PI * 640));
}

/**
 * How far from the lake center a launch may sit and still be on this lake.
 *  gate     a launch has to be on the water, so the allowance scales with the size of the lake
 *  nameGate a launch named after the lake, in the right county, earns more slack, because a
 *           long skinny lake puts its ramp well off the center point
 */
function gatesFor(l: Lake): { gate: number; nameGate: number } {
  const r = radiusMi(l.acres);
  const gate = Math.max(0.4, r * 2 + 0.2);
  return { gate, nameGate: Math.max(gate, Math.min(0.75 + r * 3, 3.5)) };
}

/**
 * Match each lake to its WDFW launch. Returns slug -> launch.
 *
 * A launch only counts when it plausibly sits on that lake. Without the distance gates a small
 * lake picks up a neighbor's ramp (Fivemile Lake was showing Lake Killarney, 1.2 miles away)
 * and a common name picks up a same-named lake across the state (Silver Lake in Pierce County
 * was showing a Silver Lake ramp 44 miles off).
 */
export function matchLaunches(lakes: Lake[], launches: Launch[]): Record<string, Launch> {
  const gates = lakes.map(gatesFor);

  // A launch named after a lake belongs to that lake. Nobody else may claim it on county alone.
  const owned = new Set<number>();
  lakes.forEach((l, i) => {
    const key = normName(l.name);
    launches.forEach((s, j) => {
      if (nameMatch(key, s.hay) && l.counties.includes(s.county) && haversine(l.lat, l.lng, s.lat, s.lng) <= gates[i].nameGate) owned.add(j);
    });
  });

  const out: Record<string, Launch> = {};
  lakes.forEach((l, i) => {
    const key = normName(l.name);
    const { gate, nameGate } = gates[i];
    let best: Launch | null = null, bestScore = -1, bestDist = Infinity;
    launches.forEach((s, j) => {
      const d = haversine(l.lat, l.lng, s.lat, s.lng);
      const nm = nameMatch(key, s.hay), co = l.counties.includes(s.county);
      let score: number;
      if (nm && co && d <= nameGate) score = 3;
      else if (nm && d <= gate) score = 2;
      else if (co && d <= gate && !owned.has(j)) score = 1;
      else return;
      if (score > bestScore || (score === bestScore && d < bestDist)) { best = s; bestScore = score; bestDist = d; }
    });
    if (best) out[l.slug] = { ...(best as Launch), dist: bestDist };
  });
  return out;
}
