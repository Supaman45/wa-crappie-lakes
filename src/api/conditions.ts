import type { Conditions } from '@/lib/types';
import { solunar } from '@/domain/scoring';
import { cToF } from '@/lib/util';

/**
 * A conditions snapshot for a catch or a trip.
 *
 * Taken at the moment of logging and stored on the row, rather than looked up later from a
 * forecast. Forecasts get revised and archives cost money; a fish logged in 2026 has to still
 * carry the barometer it was caught on in 2029, or the pattern work is built on sand.
 *
 * Everything here is best effort. No signal means a fish with no conditions, which is still a
 * fish; the snapshot never blocks or delays the save.
 */
const URL = 'https://api.open-meteo.com/v1/forecast';

interface CurrentResp {
  current?: Record<string, number | string>;
  hourly?: { time: string[]; surface_pressure?: (number | null)[] };
}

/** Pressure now minus pressure three hours ago, in mb. Falling is the number that matters. */
function trend(h: CurrentResp['hourly'], nowIso: string): number | null {
  if (!h?.time?.length || !h.surface_pressure) return null;
  const i = h.time.findIndex(t => t >= nowIso.slice(0, 13));
  const at = i < 0 ? h.time.length - 1 : i;
  const back = at - 3;
  const a = h.surface_pressure[at], b = h.surface_pressure[back];
  return back >= 0 && a != null && b != null ? Math.round((a - b) * 10) / 10 : null;
}

/**
 * Current weather at a point. Resolves to a partial snapshot on any failure rather than throwing,
 * and gives up after `timeoutMs` so tapping a species never waits on the network.
 */
export async function snapshot(lat: number, lng: number, timeoutMs = 3500): Promise<Conditions> {
  const at = new Date().toISOString();
  const base: Conditions = { at, moonIllum: Math.round(solunar(new Date()).illum) };
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const q = new URLSearchParams({
      latitude: String(lat), longitude: String(lng),
      current: 'temperature_2m,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover,precipitation',
      hourly: 'surface_pressure',
      temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', past_days: '1', forecast_days: '1',
      timezone: 'auto',
    });
    const r = await fetch(`${URL}?${q}`, { signal: ac.signal });
    clearTimeout(timer);
    if (!r.ok) return base;
    const j = await r.json() as CurrentResp;
    const c = j.current || {};
    const n = (k: string) => { const v = c[k]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
    return {
      ...base,
      airF: n('temperature_2m'),
      windMph: n('wind_speed_10m'),
      windDir: n('wind_direction_10m'),
      pressure: n('surface_pressure'),
      pressureTrend: trend(j.hourly, at),
      cloud: n('cloud_cover'),
      precip: n('precipitation'),
    };
  } catch { return base; }
}

/** Adds river flow and water temperature to a snapshot when the water has a USGS gauge. */
export async function withGauge(cond: Conditions, gaugeId: string | null | undefined, timeoutMs = 3000): Promise<Conditions> {
  if (!gaugeId) return cond;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${encodeURIComponent(gaugeId)}&parameterCd=00060,00010&siteStatus=active`, { signal: ac.signal });
    clearTimeout(timer);
    if (!r.ok) return cond;
    const j = await r.json() as { value?: { timeSeries?: { variable?: { variableCode?: { value: string }[] }; values?: { value?: { value: string }[] }[] }[] } };
    let cfs: number | null = null, waterF: number | null = null;
    for (const ts of j.value?.timeSeries || []) {
      const code = ts.variable?.variableCode?.[0]?.value;
      const raw = ts.values?.[0]?.value?.slice(-1)[0]?.value;
      const v = raw != null ? parseFloat(raw) : NaN;
      if (!Number.isFinite(v) || v <= -999) continue;
      if (code === '00060') cfs = Math.round(v);
      if (code === '00010') waterF = Math.round(cToF(v));
    }
    return { ...cond, cfs, waterF };
  } catch { return cond; }
}

/** One line for a card, from whatever the snapshot managed to capture. */
export function condText(c: Conditions | null | undefined): string {
  if (!c) return '';
  const bits: string[] = [];
  if (c.airF != null) bits.push(`${Math.round(c.airF)}°`);
  if (c.windMph != null) bits.push(`${Math.round(c.windMph)} mph`);
  if (c.cloud != null) bits.push(c.cloud >= 80 ? 'overcast' : c.cloud >= 40 ? 'partly cloudy' : 'clear');
  if (c.pressureTrend != null && Math.abs(c.pressureTrend) >= 0.6) bits.push(c.pressureTrend < 0 ? 'falling barometer' : 'rising barometer');
  if (c.cfs != null) bits.push(`${c.cfs.toLocaleString()} cfs`);
  if (c.waterF != null) bits.push(`${c.waterF}° water`);
  return bits.join(' · ');
}
