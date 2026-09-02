import type { Forecast } from '@/lib/types';
import { fmtClock } from '@/lib/util';

export const SYN = 29.530588853;
export const NEWMOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000;

export function moonFactor(dateStr: string): number {
  const d = Date.parse(dateStr + 'T12:00:00Z') / 86400000;
  const age = (((d - NEWMOON) % SYN) + SYN) % SYN;
  return Math.abs(Math.cos(2 * Math.PI * age / SYN));
}
export function skyFromCode(c: number | null | undefined): number {
  if (c == null) return .6; if (c === 0) return .45; if (c <= 2) return .8; if (c === 3) return 1; if (c <= 48) return .7; if (c <= 67) return .85; if (c <= 77) return .55; if (c <= 82) return .75; return .6;
}
export function windScore(w: number | null | undefined): number { if (w == null) return .5; if (w < 3) return .45; if (w > 22) return .2; return Math.max(.3, 1 - Math.abs(w - 8) / 16); }
export function precipScore(p: number | null | undefined): number { if (p == null) return .6; if (p <= 20) return 1; if (p <= 50) return .8; if (p <= 70) return .55; return .3; }
export function tempScore(t: number | null | undefined): number { if (t == null) return .6; if (t >= 58 && t <= 80) return 1; if (t >= 48 && t < 88) return .8; if (t >= 40 && t < 95) return .55; return .3; }

export interface DayScore { score: number; w: number | null; p: number | null; t: number | null; c: number | null; moon: number; }

export function dayScore(fc: Forecast | null | undefined, i: number): DayScore | null {
  if (!fc?.daily?.time?.[i]) return null;
  const d = fc.daily;
  const w = d.wind_speed_10m_max?.[i] ?? null, p = d.precipitation_probability_max?.[i] ?? null, t = d.temperature_2m_max?.[i] ?? null, c = d.weather_code?.[i] ?? null;
  const moon = moonFactor(d.time[i]);
  const s = .25 * windScore(w) + .25 * skyFromCode(c) + .2 * precipScore(p) + .15 * tempScore(t) + .15 * moon;
  return { score: Math.round(s * 100), w, p, t, c, moon };
}

export function whyText(x: DayScore): string {
  const b: string[] = [];
  if (skyFromCode(x.c) >= .95) b.push('overcast'); else if (skyFromCode(x.c) <= .5) b.push('bright sky');
  if (windScore(x.w) >= .8) b.push('light chop'); else if (x.w != null && x.w > 22) b.push('windy');
  if (x.p != null && x.p <= 20) b.push('dry'); else if (x.p != null && x.p > 70) b.push('wet');
  if (x.moon >= .8) b.push('strong moon');
  return b.slice(0, 3).join(', ') || 'mixed conditions';
}

export interface Solunar { majors: Date[]; minors: Date[]; illum: number; }
export function solunar(date: Date): Solunar {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const age = (((base.getTime() / 86400000) - NEWMOON) % SYN + SYN) % SYN;
  const overheadH = (12 + age * 0.8067) % 24;
  const at = (h: number) => { const d = new Date(base); d.setHours(0, 0, 0, 0); d.setMinutes(Math.round(h * 60)); return d; };
  const majors = [at(overheadH), at((overheadH + 12) % 24)].sort((a, b) => a.getTime() - b.getTime());
  const minors = [at((overheadH + 6) % 24), at((overheadH + 18) % 24)].sort((a, b) => a.getTime() - b.getTime());
  return { majors, minors, illum: Math.round((1 - Math.cos(2 * Math.PI * age / SYN)) / 2 * 100) };
}
export function solunarSummary(date: Date): { majors: string[]; minors: string[]; illum: number } {
  const s = solunar(date);
  return { majors: s.majors.map(fmtClock), minors: s.minors.map(fmtClock), illum: s.illum };
}
