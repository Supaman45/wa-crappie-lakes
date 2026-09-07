import { kvGet, kvSet } from '@/lib/db';
import { haversine } from '@/lib/util';

/**
 * Named hiking trails from OpenStreetMap (Overpass), with the USFS National Forest trail
 * layer as a fallback. Ways that share a name inside the box are merged into one trail.
 */
export interface Trail {
  id: string;
  name: string;
  lines: [number, number][][];   // [lat, lng] polylines
  miles: number;                 // total length of the merged ways inside the box
  sac: string;                   // OSM sac_scale (hiking, mountain_hiking, ...) or USFS class
  source: 'osm' | 'usfs';
}

export type BBox = [number, number, number, number]; // west, south, east, north

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const USFS = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0/query';
const TTL = 7 * 24 * 60 * 60 * 1000;

export function lineMiles(pts: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  return m;
}

function mergeByName(items: { name: string; pts: [number, number][]; sac: string; source: Trail['source'] }[]): Trail[] {
  const map = new Map<string, Trail>();
  for (const it of items) {
    if (it.pts.length < 2) continue;
    const key = it.name.trim().toLowerCase();
    const t = map.get(key) || { id: `${it.source}:${key}`, name: it.name.trim(), lines: [], miles: 0, sac: it.sac, source: it.source };
    t.lines.push(it.pts);
    t.miles += lineMiles(it.pts);
    if (!t.sac && it.sac) t.sac = it.sac;
    map.set(key, t);
  }
  return Array.from(map.values()).map(t => ({ ...t, miles: Math.round(t.miles * 10) / 10 }));
}

interface OsmWay { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; }

async function overpass(query: string, signal?: AbortSignal): Promise<OsmWay[]> {
  let lastErr: unknown = null;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), signal });
      if (!r.ok) throw new Error('Overpass ' + r.status);
      const j = await r.json() as { elements?: OsmWay[] };
      return j.elements || [];
    } catch (e) { lastErr = e; if (signal?.aborted) throw e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Overpass unavailable');
}

function fromOsm(ways: OsmWay[]): Trail[] {
  return mergeByName(ways.filter(w => w.tags?.name && w.geometry).map(w => ({
    name: w.tags!.name,
    pts: w.geometry!.map(p => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5] as [number, number]),
    sac: w.tags!.sac_scale || '',
    source: 'osm' as const,
  })));
}

async function usfs(bbox: BBox, signal?: AbortSignal): Promise<Trail[]> {
  const url = `${USFS}?where=${encodeURIComponent("trail_type='TERRA'")}&geometry=${bbox.map(n => n.toFixed(4)).join(',')}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=trail_name,segment_length,trail_class&returnGeometry=true&outSR=4326&geometryPrecision=5&f=json`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('USFS ' + r.status);
  const j = await r.json() as { features?: { attributes: { trail_name: string; segment_length: number; trail_class: number }; geometry?: { paths: number[][][] } }[] };
  const items: { name: string; pts: [number, number][]; sac: string; source: 'usfs' }[] = [];
  for (const f of j.features || []) {
    const name = (f.attributes.trail_name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const nice = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    for (const path of f.geometry?.paths || []) items.push({ name: nice, pts: path.map(p => [p[1], p[0]] as [number, number]), sac: f.attributes.trail_class ? `class ${f.attributes.trail_class}` : '', source: 'usfs' });
  }
  return mergeByName(items);
}

/** Named trails inside a bbox. OSM first, USFS if Overpass is down. Cached 7 days. */
export async function trailsInBox(bbox: BBox, signal?: AbortSignal): Promise<Trail[]> {
  const key = `trails:${bbox.map(n => n.toFixed(2)).join(',')}`;
  const cached = await kvGet<Trail[]>(key, TTL);
  if (cached) return cached;
  const [w, s, e, n] = bbox;
  const q = `[out:json][timeout:40];way["highway"~"^(path|footway)$"]["name"]["informal"!="yes"](${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)});out tags geom;`;
  let out: Trail[];
  try { out = fromOsm(await overpass(q, signal)); }
  catch (err) { if (signal?.aborted) throw err; out = await usfs(bbox, signal); }
  kvSet(key, out);
  return out;
}

/** Named trails within `km` of a point (for a lake sheet). */
export async function trailsNear(lat: number, lng: number, km = 1.5, signal?: AbortSignal): Promise<Trail[]> {
  const dLat = km / 111, dLng = km / (111 * Math.cos(lat * Math.PI / 180));
  return trailsInBox([lng - dLng, lat - dLat, lng + dLng, lat + dLat], signal);
}

export function sacLabel(sac: string): string {
  switch (sac) {
    case 'hiking': return 'easy trail';
    case 'mountain_hiking': return 'mountain trail';
    case 'demanding_mountain_hiking': return 'steep, some scrambling';
    case 'alpine_hiking': return 'alpine, hands needed';
    case 'demanding_alpine_hiking': case 'difficult_alpine_hiking': return 'climbing terrain';
    default: return sac.replace(/_/g, ' ');
  }
}
