import type { Lake } from '@/lib/types';
import type { Trail } from '@/api/trails';
import { haversine } from '@/lib/util';

/** A trail that gets you to a fishing lake. */
export interface Hike {
  id: string;
  trail: Trail;
  lake: Lake;
  miles: number;                 // trail length (one way if the trail ends at the lake)
  lakeGapMi: number;             // how close the trail comes to the lake center, minus the lake's own radius
  trailhead: { lat: number; lng: number };  // trail end farthest from the lake
  effort: 'short' | 'moderate' | 'long';
}

const KM_PER_MI = 1.60934;

/** Rough radius of a lake in miles from its acreage (a circle of the same area). */
export function lakeRadiusMi(l: Lake): number {
  const acres = l.acres || 1;
  const m2 = acres * 4046.86;
  return Math.sqrt(m2 / Math.PI) / 1000 / KM_PER_MI;
}

export function effortOf(miles: number): Hike['effort'] { return miles <= 3 ? 'short' : miles <= 6 ? 'moderate' : 'long'; }

/**
 * Pair trails with lakes they pass within `reachMi` of the shoreline.
 * Both lists come from the same area; O(trails × lakes × vertices) but the inputs are small.
 */
export function pairHikes(trails: Trail[], lakes: Lake[], reachMi = 0.15): Hike[] {
  const out: Hike[] = [];
  for (const t of trails) {
    const verts = t.lines.flat();
    if (!verts.length) continue;
    // bounding box of the trail, padded, to skip far lakes fast
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const [a, b] of verts) { if (a < minLat) minLat = a; if (a > maxLat) maxLat = a; if (b < minLng) minLng = b; if (b > maxLng) maxLng = b; }
    for (const l of lakes) {
      const pad = (lakeRadiusMi(l) + reachMi) / 60; // degrees, generous
      if (l.lat < minLat - pad || l.lat > maxLat + pad || l.lng < minLng - pad * 1.5 || l.lng > maxLng + pad * 1.5) continue;
      let best = Infinity, bestIdx = 0;
      for (let i = 0; i < verts.length; i++) { const d = haversine(verts[i][0], verts[i][1], l.lat, l.lng); if (d < best) { best = d; bestIdx = i; } }
      const gap = best - lakeRadiusMi(l);
      if (gap > reachMi) continue;
      // trailhead: the line endpoint farthest from the lake
      let th = verts[0], thd = -1;
      for (const line of t.lines) for (const p of [line[0], line[line.length - 1]]) { const d = haversine(p[0], p[1], l.lat, l.lng); if (d > thd) { thd = d; th = p; } }
      void bestIdx;
      out.push({ id: `${t.id}|${l.slug}`, trail: t, lake: l, miles: t.miles, lakeGapMi: Math.max(0, Math.round(gap * 100) / 100), trailhead: { lat: th[0], lng: th[1] }, effort: effortOf(t.miles) });
    }
  }
  return out;
}

/** Lakes within a bbox (west, south, east, north). */
export function lakesInBox(lakes: Lake[], bbox: [number, number, number, number]): Lake[] {
  const [w, s, e, n] = bbox;
  return lakes.filter(l => l.lng >= w && l.lng <= e && l.lat >= s && l.lat <= n);
}
