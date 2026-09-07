import type { Rule } from '@/api/feeds';

/**
 * North Beach (Ocean Shores to Moclips) vehicle rules, WAC 352-37-060.
 * Seasonal segments close to motor vehicles April 15 through the day after Labor Day.
 * Everything else on the North Beach strip is open to vehicles all year (25 mph, hard sand, no ATVs).
 */
export interface Segment { id: string; name: string; span: string; allYear?: boolean }

export const SEGMENTS: Segment[] = [
  { id: 'jetty', name: 'North Jetty to Marine View Dr', span: 'Ocean Shores, south end' },
  { id: 'pacific', name: 'Pacific Way to Chance a la Mer', span: 'Ocean Shores, town center' },
  { id: 'oceancity', name: 'Ocean City access, 1.8 mi north', span: 'Ocean City' },
  { id: 'benner', name: 'Benner Gap to Copalis River', span: 'Griffiths-Priday, closed all year', allYear: true },
  { id: 'rock', name: 'Copalis Rock to Boone Creek', span: 'Iron Springs' },
  { id: 'roosevelt', name: 'Roosevelt Beach to Annelyde Gap', span: 'Roosevelt Beach' },
  { id: 'moclips', name: 'Moclips (2nd St) to Quinault line', span: 'Moclips' },
];

/** Vehicles allowed here all year; the stretches people drive to fish. */
export const OPEN_STRIPS = [
  'Marine View Dr to Pacific Way (Ocean Shores)',
  'Chance a la Mer north to the Ocean City access',
  'Ocean City +1.8 mi north to Benner Gap (Copalis Beach approaches)',
  'Copalis River north to Copalis Rock',
  'Boone Creek to Roosevelt Beach access',
  'Annelyde Gap to the Moclips access',
];

export function laborDay(year: number): Date {
  const d = new Date(year, 8, 1);
  const shift = (1 - d.getDay() + 7) % 7; // first Monday
  return new Date(year, 8, 1 + shift);
}

export interface DriveStatus {
  closed: boolean;          // seasonal segments closed today
  from: Date;               // start of the current state
  until: Date;              // first day the state flips
  label: string;            // one-line summary
  daysLeft: number;         // days until the flip
}

function sameDay(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function mid(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }

/** Seasonal closure state for a date. Closed April 15 through the day after Labor Day, inclusive. */
export function driveStatus(now = new Date()): DriveStatus {
  const y = now.getFullYear();
  const today = mid(now);
  const open15 = new Date(y, 3, 15, 12);
  const ld = laborDay(y);
  const lastClosed = new Date(ld.getFullYear(), ld.getMonth(), ld.getDate() + 1, 12);
  const reopen = new Date(lastClosed.getFullYear(), lastClosed.getMonth(), lastClosed.getDate() + 1, 12);
  const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
  if (today < open15) {
    return { closed: false, from: new Date(y - 1, 8, laborDay(y - 1).getDate() + 2, 12), until: open15, daysLeft: days(today, open15), label: `Open to vehicles until April 15. Seasonal segments close April 15.` };
  }
  if (today <= lastClosed) {
    const d = days(today, reopen);
    const when = sameDay(today, lastClosed) ? 'tomorrow' : d === 1 ? 'tomorrow' : reopen.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return { closed: true, from: open15, until: reopen, daysLeft: d, label: `Seasonal segments closed to vehicles. They reopen ${when}.` };
  }
  const next = new Date(y + 1, 3, 15, 12);
  return { closed: false, from: reopen, until: next, daysLeft: days(today, next), label: `Open to vehicles since ${reopen.toLocaleDateString([], { month: 'short', day: 'numeric' })}. Seasonal segments close again April 15.` };
}

/** Is this segment closed to vehicles on the given day. */
export function segmentClosed(s: Segment, st: DriveStatus): boolean { return s.allYear || st.closed; }

const COAST_RULE_RE = /razor clam|copalis|mocrocks|ocean shores|grays harbor|marine area 2\b|marine area 2-|north beach|ocean city|moclips|pacific beach|surf ?perch|westport|coastal|domoic|point brown|damon point|north jetty|humptulips|quinault|hoquiam|wynoochee|satsop|chehalis river/i;

/** Emergency rules that touch the North Beach coast and Grays Harbor. */
export function coastRules(rules: Rule[]): Rule[] {
  return rules.filter(r => COAST_RULE_RE.test(`${r.title} ${r.location} ${r.species}`) || r.counties.includes('Grays Harbor'));
}
