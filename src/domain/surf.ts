import type { Tide } from '@/api/tides';
import type { DailyForecast } from '@/lib/types';

export interface TideWindow { lo: Tide; hi: Tide; }
export interface SurfScore { score: number; tags: string[]; primeStart: Date; daylight: boolean; }

export function dayIdx(d: Date): number {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const t1 = new Date(d); t1.setHours(0, 0, 0, 0);
  return Math.round((t1.getTime() - t0.getTime()) / 864e5);
}

export function tideWindows(tides: Tide[]): TideWindow[] {
  const wins: TideWindow[] = [];
  for (let i = 0; i < tides.length - 1; i++) if (tides[i].type === 'L' && tides[i + 1].type === 'H') wins.push({ lo: tides[i], hi: tides[i + 1] });
  return wins;
}

export function surfScore(w: TideWindow, wx: DailyForecast | null, idx: number): SurfScore {
  let pts = 40; const tags: string[] = [];
  const lo = w.lo.v;
  pts += Math.max(0, Math.min(35, Math.round((1.5 - lo) * 14)));
  if (lo <= -1) tags.push('deep minus low'); else if (lo <= 0) tags.push('minus low'); else if (lo >= 2.5) tags.push('shallow low');
  const rng = w.hi.v - w.lo.v;
  pts += rng >= 8 ? 15 : rng >= 6 ? 10 : rng >= 4 ? 6 : 2;
  if (rng >= 8) tags.push(rng.toFixed(1) + ' ft swing');
  const primeStart = new Date(w.hi.t.getTime() - 2 * 3600e3);
  let daylight = true;
  if (wx?.sunrise?.[idx] && wx.sunset?.[idx]) {
    const sr = new Date(wx.sunrise[idx]), ss = new Date(wx.sunset[idx]);
    const mid = new Date((primeStart.getTime() + w.hi.t.getTime()) / 2);
    if (mid < sr || mid > ss) { daylight = false; pts -= 25; tags.push('prime after dark'); }
  }
  const wnd = wx?.wind_speed_10m_max?.[idx];
  if (wnd != null) {
    if (wnd > 20) { pts -= 25; tags.push('blown out, ' + Math.round(wnd) + ' mph'); }
    else if (wnd > 15) { pts -= 12; tags.push('windy, ' + Math.round(wnd) + ' mph'); }
    else tags.push(Math.round(wnd) + ' mph wind');
  }
  return { score: Math.max(5, Math.min(99, pts)), tags, primeStart, daylight };
}
