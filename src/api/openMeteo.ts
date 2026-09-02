import type { Forecast } from '@/lib/types';
import { kvGet, kvSet } from '@/lib/db';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const HOUR = 60 * 60 * 1000;

/** 3-day forecast for a single point, cached one hour. */
export async function lakeForecast(lat: number, lng: number, signal?: AbortSignal): Promise<Forecast> {
  const key = `fc3:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = await kvGet<Forecast>(key, HOUR);
  if (cached) return cached;
  const url = `${BASE}?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=3`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('forecast ' + r.status);
  const j = await r.json() as Forecast;
  kvSet(key, j);
  return j;
}

/** 7-day forecast for up to 24 points in one call, cached one hour by point set. */
export async function multiForecast(points: { lat: number; lng: number }[], signal?: AbortSignal): Promise<Forecast[]> {
  if (!points.length) return [];
  const key = `fc7:${points.map(p => p.lat.toFixed(2) + ',' + p.lng.toFixed(2)).join('|')}`;
  const cached = await kvGet<Forecast[]>(key, HOUR);
  if (cached) return cached;
  const lat = points.map(p => p.lat).join(','), lng = points.map(p => p.lng).join(',');
  const url = `${BASE}?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('forecast ' + r.status);
  const d = await r.json();
  const arr = (Array.isArray(d) ? d : [d]) as Forecast[];
  kvSet(key, arr);
  return arr;
}

export async function sunWind(lat: number, lng: number, days = 10): Promise<Forecast['daily'] | null> {
  const key = `sw:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = await kvGet<Forecast['daily']>(key, HOUR);
  if (cached) return cached;
  try {
    const url = `${BASE}?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=${days}`;
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if (j?.daily) kvSet(key, j.daily);
    return j?.daily || null;
  } catch { return null; }
}
