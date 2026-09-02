import { kvGet, kvSet } from '@/lib/db';
import type { Launch } from '@/lib/types';
import { speciesFromSwifd } from '@/data/species';

const GEO = 'https://geodataservices.wdfw.wa.gov/arcgis/rest/services';
export const LAUNCH_TYPE: Record<number, string> = { 1: 'Concrete ramp', 2: 'Gravel ramp', 3: 'Hand launch', 4: 'Carry-down' };

export function normName(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(lake|lakes|pond|reservoir|access|area|ramp|boat|launch|site|wdfw|public|fishing|the|of|and)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Statewide WDFW boat launches, cached 7 days. */
export async function loadLaunches(signal?: AbortSignal): Promise<Launch[]> {
  const cached = await kvGet<Launch[]>('launches', 7 * 24 * 60 * 60 * 1000);
  if (cached?.length) return cached;
  const params = new URLSearchParams({ where: 'Launch=1', outFields: 'FacilityName,CommonName,LaunchType,Motorized,ADABoatLaunch,CountyName,HorsePowerLimit', returnGeometry: 'true', outSR: '4326', f: 'geojson' });
  const r = await fetch(`${GEO}/ApplicationServices/Major_Fishing_Area/MapServer/0/query?${params}`, { signal });
  if (!r.ok) throw new Error('WDFW ' + r.status);
  const data = await r.json();
  const out: Launch[] = (data.features || []).filter((f: any) => f.geometry?.coordinates).map((f: any) => {
    const p = f.properties || {};
    return { name: p.FacilityName || p.CommonName || 'WDFW water access', hay: normName((p.FacilityName || '') + ' ' + (p.CommonName || '')), county: (p.CountyName || '').trim(), type: LAUNCH_TYPE[p.LaunchType] || 'Launch', motor: p.Motorized === 1, ada: p.ADABoatLaunch === 1, hp: (p.HorsePowerLimit || '').trim(), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } as Launch;
  });
  if (out.length) kvSet('launches', out);
  return out;
}

export type BBox = [number, number, number, number]; // west, south, east, north (lng/lat)

function envelope(b: BBox): string {
  return encodeURIComponent(JSON.stringify({ xmin: b[0], ymin: b[1], xmax: b[2], ymax: b[3], spatialReference: { wkid: 4326 } }));
}

export interface StreamSeg {
  id: number;
  llid: string;
  name: string;
  species: string;      // app species id
  swifd: string;        // raw SWIFD species
  dist: string;         // DISTTYPE_DESC
  use: string;          // USETYPE_DESC
  run: string;          // RUNTIME_DESC
  miles: number;
  coords: [number, number][][]; // multi-line, [lat,lng]
}

/** SWIFD stream segments inside a bbox for the requested species (raw SWIFD names). Pages through 2000-row limits. */
export async function streamsInBox(bbox: BBox, swifdSpecies: string[], signal?: AbortSignal, maxPages = 4): Promise<StreamSeg[]> {
  const r = (n: number) => n.toFixed(3);
  const key = `swifd:${bbox.map(r).join(',')}:${swifdSpecies.join('|')}`;
  const cached = await kvGet<StreamSeg[]>(key, 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const where = swifdSpecies.length ? `SPECIES IN (${swifdSpecies.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})` : '1=1';
  const out: StreamSeg[] = [];
  for (let page = 0; page < maxPages; page++) {
    const url = `${GEO}/MapServices/SWIFD/MapServer/0/query?where=${encodeURIComponent(where)}&geometry=${envelope(bbox)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID,LLID,LLID_STRM_NAME,SPECIES,DISTTYPE_DESC,USETYPE_DESC,RUNTIME_DESC,Length_mi&returnGeometry=true&outSR=4326&geometryPrecision=5&resultOffset=${page * 2000}&resultRecordCount=2000&f=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('SWIFD ' + res.status);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || 'SWIFD error');
    for (const f of j.features || []) {
      const a = f.attributes || {};
      const paths: [number, number][][] = (f.geometry?.paths || []).map((p: [number, number][]) => p.map(([x, y]) => [y, x] as [number, number]));
      if (!paths.length) continue;
      out.push({ id: a.OBJECTID, llid: a.LLID || '', name: a.LLID_STRM_NAME || 'Unnamed stream', swifd: a.SPECIES || '', species: speciesFromSwifd(a.SPECIES || ''), dist: a.DISTTYPE_DESC || '', use: a.USETYPE_DESC || '', run: a.RUNTIME_DESC || '', miles: Number(a.Length_mi) || 0, coords: paths });
    }
    if (!j.exceededTransferLimit) break;
  }
  kvSet(key, out);
  return out;
}

/** All species rows for one stream (LLID), no geometry. */
export async function streamSpecies(llid: string): Promise<{ swifd: string; species: string; dist: string; use: string; run: string; miles: number }[]> {
  const key = `llid:${llid}`;
  const cached = await kvGet<ReturnType<typeof streamSpecies> extends Promise<infer T> ? T : never>(key, 7 * 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const url = `${GEO}/MapServices/SWIFD/MapServer/0/query?where=${encodeURIComponent(`LLID='${llid.replace(/'/g, "''")}'`)}&outFields=SPECIES,DISTTYPE_DESC,USETYPE_DESC,RUNTIME_DESC,Length_mi&returnGeometry=false&f=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('SWIFD ' + res.status);
  const j = await res.json();
  const rows = (j.features || []).map((f: any) => ({ swifd: f.attributes.SPECIES || '', species: speciesFromSwifd(f.attributes.SPECIES || ''), dist: f.attributes.DISTTYPE_DESC || '', use: f.attributes.USETYPE_DESC || '', run: f.attributes.RUNTIME_DESC || '', miles: Number(f.attributes.Length_mi) || 0 }));
  kvSet(key, rows);
  return rows;
}

export type BarrierKind = 'total' | 'partial' | 'unknown' | 'diversion' | 'natural';
export interface Barrier { id: string; kind: BarrierKind; stream: string; feature: string; owner: string; passable: string; gainMi: number | null; lat: number; lng: number; species: string; }

const BARRIER_LAYERS: { id: number; kind: BarrierKind }[] = [{ id: 2, kind: 'total' }, { id: 1, kind: 'partial' }, { id: 5, kind: 'natural' }, { id: 3, kind: 'unknown' }, { id: 4, kind: 'diversion' }];
const OWNER: Record<number, string> = { 1: 'City', 2: 'County', 3: 'Federal', 4: 'Private', 5: 'State', 6: 'Tribal', 7: 'Other', 8: 'Port', 9: 'Drainage district', 10: 'Diking district', 11: 'Irrigation district', 12: 'Unknown' };

export async function barriersInBox(bbox: BBox, signal?: AbortSignal): Promise<Barrier[]> {
  const r = (n: number) => n.toFixed(3);
  const key = `fp:${bbox.map(r).join(',')}`;
  const cached = await kvGet<Barrier[]>(key, 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const out: Barrier[] = [];
  await Promise.all(BARRIER_LAYERS.map(async ({ id, kind }) => {
    try {
      const url = `${GEO}/ApplicationServices/FP_Sites/MapServer/${id}/query?where=1%3D1&geometry=${envelope(bbox)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SiteRecordID,SiteId,StreamName,FeatureType,OwnerTypeCode,PercentFishPassableCode,LinealGainMeasurement,PotentialSpecies&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json`;
      const res = await fetch(url, { signal });
      if (!res.ok) return;
      const j = await res.json();
      for (const f of j.features || []) {
        const a = f.attributes || {}; if (!f.geometry) continue;
        out.push({ id: String(a.SiteRecordID || a.SiteId || `${id}-${f.geometry.x}`), kind, stream: a.StreamName || '', feature: a.FeatureType || '', owner: OWNER[a.OwnerTypeCode] || '', passable: String(a.PercentFishPassableCode ?? ''), gainMi: a.LinealGainMeasurement != null ? Number(a.LinealGainMeasurement) : null, lat: f.geometry.y, lng: f.geometry.x, species: a.PotentialSpecies || '' });
      }
    } catch { /* one layer failing should not block the rest */ }
  }));
  kvSet(key, out);
  return out;
}

export interface AccessSite { id: string; name: string; kind: 'launch' | 'shore'; lat: number; lng: number; motor: boolean | null; restrooms: boolean | null; launchType: string; county: string; desc: string; }

export async function accessInBox(bbox: BBox, signal?: AbortSignal): Promise<AccessSite[]> {
  const r = (n: number) => n.toFixed(3);
  const key = `acc:${bbox.map(r).join(',')}`;
  const cached = await kvGet<AccessSite[]>(key, 7 * 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const out: AccessSite[] = [];
  const g = envelope(bbox);
  await Promise.all([
    (async () => {
      try {
        const url = `${GEO}/ApplicationServices/FishWA_2014_AllLakes_PROD/MapServer/0/query?where=1%3D1&geometry=${g}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json`;
        const res = await fetch(url, { signal }); if (!res.ok) return; const j = await res.json();
        for (const f of j.features || []) {
          const a = f.attributes || {}; if (!f.geometry) continue;
          const name = a.FacilityName || a.Facility_Name || a.NAME || a.Name || 'Water access site';
          out.push({ id: 'wa-' + (a.ObjectID ?? a.OBJECTID ?? name), name, kind: 'launch', lat: f.geometry.y, lng: f.geometry.x, motor: a.Motorized == null ? null : (a.Motorized === 1 || a.Motorized === 'Yes'), restrooms: a.Restrooms == null ? null : (a.Restrooms === 1 || a.Restrooms === 'Yes'), launchType: a.LaunchType ? (LAUNCH_TYPE[a.LaunchType] || String(a.LaunchType)) : '', county: a.CountyName || a.County || '', desc: '' });
        }
      } catch { /* ignore */ }
    })(),
    (async () => {
      try {
        const url = `${GEO}/FP_FishMaps/ShoreFishingSites/MapServer/0/query?where=1%3D1&geometry=${g}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=1000&f=json`;
        const res = await fetch(url, { signal }); if (!res.ok) return; const j = await res.json();
        for (const f of j.features || []) {
          const a = f.attributes || {}; if (!f.geometry) continue;
          out.push({ id: 'sh-' + (a.AccessSiteID ?? a.OBJECTID), name: a.LakeName || 'Shore fishing site', kind: 'shore', lat: f.geometry.y, lng: f.geometry.x, motor: null, restrooms: null, launchType: '', county: a.County || '', desc: a.Description || '' });
        }
      } catch { /* ignore */ }
    })(),
  ]);
  kvSet(key, out);
  return out;
}
