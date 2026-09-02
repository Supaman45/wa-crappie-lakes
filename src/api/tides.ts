export interface Tide { t: Date; v: number; type: 'H' | 'L'; }

export const SURF_SITE = { name: 'Copalis Beach', station: '9441156', lat: 47.113, lng: -124.175 };

export async function fetchNoaaTides(station = SURF_SITE.station): Promise<Tide[]> {
  const d0 = new Date(), d9 = new Date(Date.now() + 9 * 864e5);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fd = (d: Date) => '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=wa_fish_finder&begin_date=${fd(d0)}&end_date=${fd(d9)}&datum=MLLW&station=${station}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('NOAA HTTP ' + r.status);
  const j = await r.json();
  if (j.error) throw new Error('NOAA: ' + (j.error.message || 'error'));
  if (!j.predictions?.length) throw new Error('NOAA returned no predictions');
  return (j.predictions as { t: string; v: string; type: 'H' | 'L' }[]).map(p => ({ t: new Date(p.t.replace(' ', 'T')), v: parseFloat(p.v), type: p.type }));
}

export async function fetchModelTides(lat = SURF_SITE.lat, lng = SURF_SITE.lng): Promise<Tide[]> {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=sea_level_height_msl&timezone=auto&forecast_days=10`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('backup HTTP ' + r.status);
  const j = await r.json();
  const T: string[] = j.hourly?.time || [], V: (number | null)[] = j.hourly?.sea_level_height_msl || [];
  if (V.length < 24) throw new Error('backup returned no sea level data');
  const byDay: Record<string, number> = {};
  V.forEach((v, i) => { if (v == null) return; const d = T[i].slice(0, 10); if (!(d in byDay) || v < byDay[d]) byDay[d] = v; });
  const lows = Object.values(byDay);
  const off = lows.reduce((s, x) => s + x, 0) / lows.length;
  const out: Tide[] = [];
  for (let i = 1; i < V.length - 1; i++) {
    const a = V[i - 1], b = V[i], c = V[i + 1];
    if (a == null || b == null || c == null) continue;
    if (b <= a && b < c) out.push({ t: new Date(T[i]), v: (b - off) * 3.28084, type: 'L' });
    else if (b >= a && b > c) out.push({ t: new Date(T[i]), v: (b - off) * 3.28084, type: 'H' });
  }
  if (!out.length) throw new Error('backup found no tide swings');
  return out;
}
