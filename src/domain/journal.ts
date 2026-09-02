import type { Catch, Visit, Trip, Lake, LakeTag, Profile } from '@/lib/types';
import type { LogStats } from '@/store/data';
import { haversine, acreFmt } from '@/lib/util';

export interface Totals { catches: number; visits: number; lakes: number; trips: number; biggest: Catch | null; heaviest: Catch | null; }

export function totals(catches: Catch[], visits: Visit[], trips: Trip[]): Totals {
  const lakes = new Set<string>([...catches.map(c => c.lake_id), ...visits.map(v => v.lake_id)]);
  let biggest: Catch | null = null, heaviest: Catch | null = null;
  for (const c of catches) {
    if (c.length != null && (!biggest || c.length > (biggest.length || 0))) biggest = c;
    if (c.weight != null && (!heaviest || c.weight > (heaviest.weight || 0))) heaviest = c;
  }
  return { catches: catches.reduce((s, c) => s + (c.qty || 1), 0), visits: visits.length, lakes: lakes.size, trips: trips.length, biggest, heaviest };
}

/** Catch counts by month (0..11) for the heatmap. */
export function monthHeat(catches: Catch[]): number[] {
  const m = new Array(12).fill(0);
  for (const c of catches) { const mo = parseInt(c.date.slice(5, 7), 10) - 1; if (mo >= 0 && mo < 12) m[mo] += c.qty || 1; }
  return m;
}

export interface LeaderRow { profile: Profile; catches: number; visits: number; biggest: number | null; }
export function leaderboard(catches: Catch[], visits: Visit[], profiles: Record<string, Profile>): LeaderRow[] {
  const map = new Map<string, LeaderRow>();
  const get = (uid: string) => map.get(uid) || (map.set(uid, { profile: profiles[uid] || { id: uid, name: 'Angler', color: '#8fa79e' }, catches: 0, visits: 0, biggest: null }), map.get(uid)!);
  for (const c of catches) { const r = get(c.user_id); r.catches += c.qty || 1; if (c.length != null && (r.biggest == null || c.length > r.biggest)) r.biggest = c.length; }
  for (const v of visits) get(v.user_id).visits++;
  return Array.from(map.values()).sort((a, b) => b.catches - a.catches || b.visits - a.visits);
}

export interface Record_ { label: string; value: string; sub: string; }
export function records(catches: Catch[], profiles: Record<string, Profile>): Record_[] {
  const out: Record_[] = [];
  const who = (c: Catch) => profiles[c.user_id]?.name || 'Angler';
  const bySp = new Map<string, Catch>();
  for (const c of catches) { if (c.length == null) continue; const b = bySp.get(c.species); if (!b || c.length > (b.length || 0)) bySp.set(c.species, c); }
  for (const [sp, c] of bySp) out.push({ label: `Longest ${sp}`, value: `${c.length}"`, sub: `${who(c)}, ${c.lake_name || c.lake_id}, ${c.date}` });
  const heavy = catches.filter(c => c.weight != null).sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
  if (heavy) out.push({ label: 'Heaviest', value: `${heavy.weight} lb`, sub: `${who(heavy)}, ${heavy.lake_name || heavy.lake_id}, ${heavy.date}` });
  const byDay = new Map<string, number>();
  for (const c of catches) { const k = `${c.user_id}|${c.lake_id}|${c.date}`; byDay.set(k, (byDay.get(k) || 0) + (c.qty || 1)); }
  let bestDay: [string, number] | null = null; for (const e of byDay) if (!bestDay || e[1] > bestDay[1]) bestDay = e;
  if (bestDay) { const [uid, lake, date] = bestDay[0].split('|'); out.push({ label: 'Best day', value: `${bestDay[1]} fish`, sub: `${profiles[uid]?.name || 'Angler'}, ${lake}, ${date}` }); }
  return out;
}

export interface Insight { text: string; }
export function insights(catches: Catch[], visits: Visit[]): Insight[] {
  const out: Insight[] = [];
  if (!catches.length) return out;
  const bait = new Map<string, number>(); const struct = new Map<string, number>(); const depth: number[] = []; const temps: number[] = [];
  for (const c of catches) {
    if (c.bait) bait.set(c.bait, (bait.get(c.bait) || 0) + (c.qty || 1));
    if (c.structure) struct.set(c.structure, (struct.get(c.structure) || 0) + (c.qty || 1));
    if (c.depth != null) depth.push(c.depth);
    if (c.water_temp != null) temps.push(c.water_temp);
  }
  const top = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
  const tb = top(bait); if (tb) out.push({ text: `${tb[0]} accounts for ${tb[1]} of your crew's fish, more than any other bait.` });
  const ts = top(struct); if (ts) out.push({ text: `${ts[0]} produced ${ts[1]} fish, the most productive structure logged.` });
  if (depth.length >= 3) { const s = depth.slice().sort((a, b) => a - b); out.push({ text: `Half your fish came between ${s[Math.floor(s.length * .25)]} and ${s[Math.floor(s.length * .75)]} ft.` }); }
  if (temps.length >= 3) { const avg = temps.reduce((a, b) => a + b, 0) / temps.length; out.push({ text: `Average water temp on catch days: ${avg.toFixed(0)}°F.` }); }
  const heat = monthHeat(catches); const bestMo = heat.indexOf(Math.max(...heat));
  if (heat[bestMo] > 0) out.push({ text: `${['January','February','March','April','May','June','July','August','September','October','November','December'][bestMo]} is your best month with ${heat[bestMo]} fish logged.` });
  const skunk = visits.filter(v => !catches.some(c => c.user_id === v.user_id && c.lake_id === v.lake_id && c.date === v.date)).length;
  if (visits.length) out.push({ text: `${Math.round((1 - skunk / visits.length) * 100)}% of logged visits produced at least one fish.` });
  return out;
}

export interface Pair { p: Lake; s: Lake; d: number; sc: number; why: string; }
export function pairSuggestions(lakes: Lake[], stats: (l: Lake) => LogStats, tag: (l: Lake) => LakeTag | undefined): Pair[] {
  const provs = lakes.filter(l => { const st = stats(l), m = tag(l); return st.catches > 0 || m?.cat === 'Honey hole' || m?.cat === 'Producer'; }).sort((a, b) => stats(b).catches - stats(a).catches).slice(0, 8);
  const scouts = lakes.filter(l => { const st = stats(l), m = tag(l); if (m?.cat === 'Skip' || m?.cat === 'Crowded') return false; return !!m?.wish || m?.cat === 'Scouting' || st.visits === 0; });
  const pairs: Pair[] = []; const used: Record<number, boolean> = {};
  for (const p of provs) {
    let best: { s: Lake; d: number; sc: number } | null = null;
    for (const s of scouts) {
      if (s.id === p.id || used[s.id]) continue;
      const d = haversine(p.lat, p.lng, s.lat, s.lng); if (d > 30) continue;
      const m = tag(s); const sc = (30 - d) + (m?.wish ? 12 : 0) + (m?.cat === 'Scouting' ? 12 : 0) + Math.min(stats(p).catches, 20) * 1.5;
      if (!best || sc > best.sc) best = { s, d, sc };
    }
    if (best) { const m = tag(best.s); pairs.push({ p, s: best.s, d: best.d, sc: best.sc, why: m?.wish ? 'wish list' : m?.cat === 'Scouting' ? 'marked Scouting' : 'never visited' }); used[p.id] = true; used[best.s.id] = true; }
  }
  return pairs.sort((a, b) => b.sc - a.sc).slice(0, 4);
}

function csvCell(v: unknown): string { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
export function catchesCsv(catches: Catch[], profiles: Record<string, Profile>): string {
  const head = ['date', 'angler', 'water', 'water_type', 'species', 'qty', 'length_in', 'weight_lb', 'depth_ft', 'water_temp_f', 'bait', 'structure', 'notes'];
  const rows = catches.map(c => [c.date, profiles[c.user_id]?.name || '', c.lake_name || c.lake_id, c.water_type, c.species, c.qty, c.length, c.weight, c.depth, c.water_temp, c.bait, c.structure, c.notes].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n');
}
export function visitsCsv(visits: Visit[], profiles: Record<string, Profile>): string {
  const head = ['date', 'angler', 'water', 'water_type'];
  return [head.join(','), ...visits.map(v => [v.date, profiles[v.user_id]?.name || '', v.lake_name || v.lake_id, v.water_type].map(csvCell).join(','))].join('\n');
}

export function lakeSub(l: Lake): string { return `${l.counties.join(', ')} · ${acreFmt(l.acres)} ac · ${l.elev.toLocaleString()} ft`; }

/** Share or download text; Web Share first (works in iOS standalone), blob download as fallback. */
export async function shareText(filename: string, text: string, mime = 'text/csv'): Promise<void> {
  const file = new File([text], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) { try { await nav.share({ files: [file], title: filename }); return; } catch { /* fall through */ } }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
