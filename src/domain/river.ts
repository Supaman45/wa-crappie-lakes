/**
 * River Watch: rivers shared with a treaty tribe, where the days you may fish and the days the
 * nets are in the water are two different calendars.
 *
 * The Puyallup is the first one. Two sources sit behind everything here:
 *  - Sport season, boundaries and limits: WAC 220-312-040 (freshwater exceptions to statewide
 *    rules), cross-checked against the 2026-2027 Co-Managers' List of Agreed Fisheries.
 *  - Tribal net windows: the Puyallup Tribe of Indians files each opening as a PDF on its
 *    Fisheries Harvest and Regulations page. Every window below carries the filing it came from,
 *    so /api/river can tell the card when a filing it has not seen shows up.
 *
 * Dates are local. The app runs in Pacific time on the water.
 */

export interface Season {
  /** Inclusive, 'MM-DD'. Ignored when `anchor` is set. */
  start: string;
  end: string;
  /** Open weekdays, 0 = Sunday. Null means every day. */
  days: number[] | null;
  label: string;
  /** Movable opener. 'sat-before-memorial-day' is the WAC phrasing on several rivers. */
  anchor?: 'sat-before-memorial-day';
}

/** Last Monday in May. */
export function memorialDay(year: number): Date {
  const d = new Date(year, 4, 31);
  return new Date(year, 4, 31 - ((d.getDay() - 1 + 7) % 7));
}

function seasonStart(s: Season, year: number): string {
  if (s.anchor !== 'sat-before-memorial-day') return s.start;
  const m = memorialDay(year);
  const sat = new Date(year, m.getMonth(), m.getDate() - 2);
  return `${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;
}

export interface Section {
  id: string;
  name: string;
  span: string;
  /** True when tribal nets are set in this water. */
  netted: boolean;
  seasons: Season[];
  note?: string;
  lat?: number;
  lng?: number;
}

export interface NetWindow {
  id: string;
  species: string;
  /** Local ISO, 'YYYY-MM-DDTHH:mm'. */
  open: string;
  close: string;
  /** Filing file name, matched against what /api/river finds. */
  filing: string;
  filingNo: string;
}

/** A fishery the co-managers have agreed to but has not been filed with dates yet. */
export interface PendingNets {
  from: string;
  label: string;
}

export interface WatchRiver {
  id: string;
  name: string;
  counties: string[];
  lat: number;
  lng: number;
  /** Who shares the river. */
  tribe: string;
  netArea: string;
  sections: Section[];
  nets: NetWindow[];
  pending: PendingNets[];
  /** Other treaty fisheries on the system, for context. */
  sideNotes: string[];
  limits: string[];
  filingsUrl: string;
  regsUrl: string;
  /** Filing files the windows above were read from. Anything else is news. */
  knownFilings: string[];
  /** Date the filings page was last read by hand, 'YYYY-MM-DD'. Older filings are archive. */
  readOn: string;
  sourceNote: string;
}

const PUY_SEASONS: Season[] = [
  { start: '08-19', end: '09-30', days: [3, 4, 5, 6], label: 'Wednesday through Saturday only' },
  { start: '10-01', end: '10-31', days: null, label: 'Open every day' },
];

export const PUYALLUP: WatchRiver = {
  id: 'puyallup',
  name: 'Puyallup River',
  counties: ['Pierce'],
  lat: 47.1854,
  lng: -122.2946,
  tribe: 'Puyallup Tribe of Indians',
  netArea: 'White River confluence downstream to the green light at the river mouth',
  sections: [
    {
      id: 'lower',
      name: '11th St Bridge to Clarks Creek',
      span: 'Tacoma to Puyallup, lower river',
      netted: true,
      seasons: PUY_SEASONS,
      note: 'Closed waters 400 ft either side of the Clarks Creek mouth.',
      lat: 47.2472, lng: -122.4088,
    },
    {
      id: 'mid',
      name: 'Clarks Creek to East Main Bridge',
      span: 'City of Puyallup',
      netted: true,
      seasons: PUY_SEASONS,
      note: 'Starts 400 ft above the Clarks Creek mouth.',
      lat: 47.1912, lng: -122.2938,
    },
    {
      id: 'upper',
      name: 'East Main Bridge to the Carbon River',
      span: 'Puyallup up to Orting',
      netted: false,
      seasons: PUY_SEASONS,
      note: 'Above the White River confluence, so no nets are set in this water.',
      lat: 47.1372, lng: -122.2044,
    },
    {
      id: 'above-carbon',
      name: 'Above the Carbon River',
      span: 'Orting and upstream',
      netted: false,
      seasons: [{ start: '05-23', end: '01-15', days: null, anchor: 'sat-before-memorial-day', label: 'Saturday before Memorial Day through January 15, selective gear' }],
      note: 'Selective gear rules. Release cutthroat and wild rainbow.',
      lat: 47.0975, lng: -122.2036,
    },
  ],
  nets: [
    { id: 'coho-0913', species: 'Coho', open: '2026-09-13T12:00', close: '2026-09-15T12:00', filing: 'Coho-2nd.pdf', filingNo: '12-2026/2027' },
    { id: 'coho-0920', species: 'Coho', open: '2026-09-20T12:00', close: '2026-09-22T12:00', filing: 'Coho-2nd.pdf', filingNo: '12-2026/2027' },
    { id: 'coho-0927', species: 'Coho', open: '2026-09-27T12:00', close: '2026-09-29T12:00', filing: 'Coho-2nd.pdf', filingNo: '12-2026/2027' },
    { id: 'coho-1004', species: 'Coho', open: '2026-10-04T12:00', close: '2026-10-06T12:00', filing: 'Coho-2nd.pdf', filingNo: '12-2026/2027' },
    { id: 'coho-1011', species: 'Coho', open: '2026-10-11T12:00', close: '2026-10-13T12:00', filing: 'Coho-2nd.pdf', filingNo: '12-2026/2027' },
  ],
  pending: [
    { from: '2026-10-18', label: 'Chum test fishery, one day a week from the week of Oct 18, drift net only. Days are set by filing.' },
    { from: '2026-11-01', label: 'Chum commercial fishery, one to three days a week from the week of Nov 1 through the week of Dec 27. Your season below the Carbon is already closed by then.' },
  ],
  sideNotes: [
    'White River: a separate treaty gillnet fishery, Sunday through Friday, Aug 30 to Oct 11, from the Puyallup and White confluence up to the R St Bridge.',
  ],
  limits: [
    'Six salmon a day, no more than two adults, 12 in minimum.',
    'Release chum and wild Chinook. Release cutthroat and wild rainbow.',
    'Barbless hooks, anti-snagging rule, night closure.',
  ],
  filingsUrl: 'https://www.puyalluptribe-nsn.gov/member-services/tribal-natural-resources/fisheries/harvest-regulations/',
  regsUrl: 'https://apps.leg.wa.gov/WAC/default.aspx?cite=220-312-040',
  knownFilings: ['Coho-2nd.pdf', 'Chinook-2nd-Opening.pdf', 'Chinook-1st-2026.pdf', '2026-2027-Annual-Fishing-Regulations.pdf'],
  readOn: '2026-09-16',
  sourceNote: 'Sport dates from WAC 220-312-040. Net dates from tribal filing 12-2026/2027, read Sept 16, 2026.',
};

export const WATCH_RIVERS: WatchRiver[] = [PUYALLUP];

/* ---------------- date helpers ---------------- */

function midnight(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function md(d: Date): string { return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/** Local Date from 'YYYY-MM-DDTHH:mm'. Avoids the UTC parse the Z-less ISO form gets in some engines. */
export function localDate(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return new Date(s);
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

/** True when 'MM-DD' d falls inside start..end, handling a window that wraps the new year. */
function inWindow(d: string, start: string, end: string): boolean {
  return start <= end ? d >= start && d <= end : d >= start || d <= end;
}

/* ---------------- sport season ---------------- */

export interface DayOpen { open: boolean; season: Season | null; why: string }

/** Is this section open to you on this calendar day? */
export function sportOn(sec: Section, day: Date): DayOpen {
  const key = md(day);
  for (const s of sec.seasons) {
    if (!inWindow(key, seasonStart(s, day.getFullYear()), s.end)) continue;
    if (s.days && !s.days.includes(day.getDay())) return { open: false, season: s, why: s.label };
    return { open: true, season: s, why: s.label };
  }
  return { open: false, season: null, why: 'Outside the season' };
}

/** First day from `from` the section is open, looking ahead at most `limit` days. */
export function nextOpenDay(sec: Section, from: Date, limit = 120): Date | null {
  for (let i = 0; i <= limit; i++) {
    const d = addDays(midnight(from), i);
    if (sportOn(sec, d).open) return d;
  }
  return null;
}

/* ---------------- nets ---------------- */

export interface NetState {
  /** Nets are in the water right now. */
  inNow: boolean;
  current: NetWindow | null;
  next: NetWindow | null;
  /** Filed windows have run out but more fishing is agreed. */
  pending: PendingNets | null;
  /**
   * Every window and pending note shipped with the app is in the past. The schedule is refiled
   * each season, so past this point the card must stop implying it knows the calendar.
   */
  stale: boolean;
}

export function netState(river: WatchRiver, now = new Date()): NetState {
  let current: NetWindow | null = null;
  let next: NetWindow | null = null;
  for (const w of river.nets) {
    const o = localDate(w.open), c = localDate(w.close);
    if (now >= o && now < c) current = w;
    else if (o > now && (!next || o < localDate(next.open))) next = w;
  }
  let pending: PendingNets | null = null;
  if (!current && !next) {
    for (const p of river.pending) {
      const f = localDate(p.from);
      if (!pending && f >= midnight(now)) pending = p;
    }
    if (!pending && river.pending.length) {
      const last = river.pending[river.pending.length - 1];
      if (localDate(last.from) <= now) pending = last;
    }
  }
  const last = river.nets[river.nets.length - 1];
  const lastPending = river.pending[river.pending.length - 1];
  const horizon = Math.max(
    last ? localDate(last.close).getTime() : 0,
    lastPending ? localDate(lastPending.from).getTime() + 45 * 86400000 : 0,
  );
  const stale = !current && !next && now.getTime() > horizon;
  return { inNow: !!current, current, next, pending: stale ? null : pending, stale };
}

/** True when any net window covers part of this calendar day. */
export function netsOn(river: WatchRiver, day: Date): NetWindow | null {
  const a = midnight(day), b = addDays(a, 1);
  for (const w of river.nets) {
    if (localDate(w.open) < b && localDate(w.close) > a) return w;
  }
  return null;
}

/* ---------------- the combined read ---------------- */

export type Verdict = 'go' | 'nets' | 'closed';

export interface DayRow {
  date: Date;
  open: boolean;
  why: string;
  net: NetWindow | null;
  verdict: Verdict;
}

/**
 * Next `days` days for one section. `go` means open with no nets in your water, `nets` means open
 * but the tribe is fishing the water you are standing in, `closed` means the season is shut.
 */
export function outlook(river: WatchRiver, sec: Section, now = new Date(), days = 10): DayRow[] {
  const out: DayRow[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(midnight(now), i);
    const s = sportOn(sec, date);
    const net = sec.netted ? netsOn(river, date) : null;
    out.push({ date, open: s.open, why: s.why, net, verdict: !s.open ? 'closed' : net ? 'nets' : 'go' });
  }
  return out;
}

/** The first day ahead that is open to you with no nets in that section. */
export function nextClearDay(river: WatchRiver, sec: Section, now = new Date()): DayRow | null {
  return outlook(river, sec, now, 45).find(r => r.verdict === 'go') || null;
}

/** A section of the same river that is open on `day` and carries no nets. */
export function clearAlternative(river: WatchRiver, day: Date, notId: string): Section | null {
  return river.sections.find(s => s.id !== notId && !s.netted && sportOn(s, day).open) || null;
}

export function fmtWindow(w: NetWindow): string {
  const o = localDate(w.open), c = localDate(w.close);
  const day = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d: Date) => d.getHours() === 12 && d.getMinutes() === 0 ? 'noon' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${time(o)} ${day(o)} to ${time(c)} ${day(c)}`;
}

/**
 * Filings the curated windows above were not read from. The page carries several seasons of
 * archive, so a filing only counts as news when it was posted on or after the day the windows
 * were read, or when it sits above every known filing in the page's reverse-chronological order.
 */
export function newFilings<T extends { file: string; posted: string | null; river: boolean }>(river: WatchRiver, list: T[]): T[] {
  const known = new Set(river.knownFilings);
  const idx = list.reduce((min, f, i) => (known.has(f.file) && i < min ? i : min), Number.MAX_SAFE_INTEGER);
  return list.filter((f, i) => f.river && !known.has(f.file) && ((f.posted && f.posted >= river.readOn) || i < idx));
}
