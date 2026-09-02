import { kvGet, kvSet } from '@/lib/db';

export interface Gauge {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cfs: number | null;
  tempC: number | null;
  at: string | null;
}

const IV = 'https://waterservices.usgs.gov/nwis/iv/';
const TTL = 20 * 60 * 1000;

interface TS {
  sourceInfo: { siteName: string; siteCode: { value: string }[]; geoLocation: { geogLocation: { latitude: number; longitude: number } } };
  variable: { variableCode: { value: string }[] };
  values: { value: { value: string; dateTime: string }[] }[];
}

function parse(j: { value?: { timeSeries?: TS[] } }): Gauge[] {
  const map = new Map<string, Gauge>();
  for (const ts of j.value?.timeSeries || []) {
    const id = ts.sourceInfo.siteCode?.[0]?.value; if (!id) continue;
    const g = map.get(id) || { id, name: titleCase(ts.sourceInfo.siteName), lat: ts.sourceInfo.geoLocation.geogLocation.latitude, lng: ts.sourceInfo.geoLocation.geogLocation.longitude, cfs: null, tempC: null, at: null };
    const v = ts.values?.[0]?.value?.[0];
    const code = ts.variable.variableCode?.[0]?.value;
    if (v) {
      const num = parseFloat(v.value);
      if (Number.isFinite(num) && num > -99999) {
        if (code === '00060') g.cfs = num;
        if (code === '00010') g.tempC = num;
        g.at = v.dateTime;
      }
    }
    map.set(id, g);
  }
  return Array.from(map.values());
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\bWa\b/, 'WA').replace(/\bNr\b/, 'near').replace(/\bAb\b/, 'above').replace(/\bBl\b/, 'below').replace(/\bAt\b/, 'at').replace(/\bNear\b/, 'near');
}

/** Live flow and temperature for stream gauges inside a bbox [west, south, east, north]. */
export async function gaugesInBox(bbox: [number, number, number, number], signal?: AbortSignal): Promise<Gauge[]> {
  const r = (n: number) => n.toFixed(2);
  const key = `usgs:${bbox.map(r).join(',')}`;
  const cached = await kvGet<Gauge[]>(key, TTL);
  if (cached) return cached;
  const url = `${IV}?format=json&bBox=${bbox.map(n => n.toFixed(4)).join(',')}&parameterCd=00060,00010&siteType=ST&siteStatus=active`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('USGS ' + res.status);
  const out = parse(await res.json());
  kvSet(key, out);
  return out;
}

/** Live flow and temperature for a list of USGS site ids (up to 100 per request). */
export async function gaugesBySites(ids: string[], signal?: AbortSignal): Promise<Record<string, Gauge>> {
  const clean = Array.from(new Set(ids.filter(Boolean))).sort();
  if (!clean.length) return {};
  const key = `usgss:${clean.join(',')}`;
  const cached = await kvGet<Record<string, Gauge>>(key, TTL);
  if (cached) return cached;
  const url = `${IV}?format=json&sites=${clean.join(',')}&parameterCd=00060,00010&siteStatus=all`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('USGS ' + res.status);
  const out: Record<string, Gauge> = {};
  for (const g of parse(await res.json())) out[g.id] = g;
  kvSet(key, out);
  return out;
}

export interface GaugeHistory { dates: string[]; cfs: (number | null)[]; tempC: (number | null)[]; }

/** 7-day daily means for one gauge (for trend and median context). */
export async function gaugeHistory(id: string, days = 30): Promise<GaugeHistory> {
  const key = `usgsh:${id}:${days}`;
  const cached = await kvGet<GaugeHistory>(key, 6 * 60 * 60 * 1000);
  if (cached) return cached;
  const url = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${id}&period=P${days}D&parameterCd=00060,00010&statCd=00003`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('USGS ' + res.status);
  const j = await res.json() as { value?: { timeSeries?: TS[] } };
  const out: GaugeHistory = { dates: [], cfs: [], tempC: [] };
  const byDate: Record<string, { cfs?: number; t?: number }> = {};
  for (const ts of j.value?.timeSeries || []) {
    const code = ts.variable.variableCode?.[0]?.value;
    for (const v of ts.values?.[0]?.value || []) {
      const d = v.dateTime.slice(0, 10); const n = parseFloat(v.value);
      const e = byDate[d] || (byDate[d] = {});
      if (Number.isFinite(n)) { if (code === '00060') e.cfs = n; if (code === '00010') e.t = n; }
    }
  }
  for (const d of Object.keys(byDate).sort()) { out.dates.push(d); out.cfs.push(byDate[d].cfs ?? null); out.tempC.push(byDate[d].t ?? null); }
  kvSet(key, out);
  return out;
}
