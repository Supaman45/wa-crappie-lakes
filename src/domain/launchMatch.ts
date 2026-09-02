import type { Lake, Launch } from '@/lib/types';
import { haversine } from '@/lib/util';
import { normName } from '@/api/wdfw';

function nameMatch(key: string, hay: string): boolean {
  if (!key) return false;
  if (key.length >= 4 && hay.includes(key)) return true;
  const t = key.split(' ').filter(x => x.length >= 3);
  return t.length > 0 && t.every(x => hay.includes(x));
}

/** Match each lake to its most likely WDFW launch. Returns slug -> launch. */
export function matchLaunches(lakes: Lake[], launches: Launch[]): Record<string, Launch> {
  const out: Record<string, Launch> = {};
  for (const l of lakes) {
    const key = normName(l.name), gate = (l.acres || 0) > 5000 ? 30 : (l.acres || 0) > 500 ? 14 : 7;
    let best: Launch | null = null, bestScore = -1, bestDist = Infinity;
    for (const s of launches) {
      const d = haversine(l.lat, l.lng, s.lat, s.lng), nm = nameMatch(key, s.hay), co = l.counties.includes(s.county);
      if (d > gate && !(nm && d < 45)) continue;
      let score: number; if (nm && co) score = 3; else if (nm) score = 2; else if (co && d < 5) score = 1; else continue;
      if (score > bestScore || (score === bestScore && d < bestDist)) { best = s; bestScore = score; bestDist = d; }
    }
    if (best) out[l.slug] = { ...best, dist: bestDist };
  }
  return out;
}
