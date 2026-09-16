import type { Catch, SpeciesId } from '@/lib/types';

/**
 * Washington Catch Record Card.
 *
 * WDFW requires a catch record card for salmon, steelhead, sturgeon, halibut and Puget Sound
 * Dungeness crab. After you RETAIN one you record it before you carry on fishing. Released fish
 * do not go on the card.
 *
 * This is a mirror, not a replacement. WDFW runs its own electronic card in the MyWDFW and Fish
 * Washington apps as of the 2026-2027 license year; a paper card is still legal and is due back
 * April 30 for fish. What this view does is keep the same rows in the same order as the card, so
 * copying across takes seconds and a season's record survives a lost card. The UI says so.
 *
 * Card columns: catch area code, month, day, species, clip type (hatchery or wild).
 */

export const CRC_SPECIES: SpeciesId[] = ['chinook', 'coho', 'steelhead'];

/** Species the card covers that the app also tracks. */
export function needsCard(species: string): boolean {
  return (CRC_SPECIES as string[]).includes(species);
}

/** A kept fish of a card species is the only thing that goes on the card. */
export function onCard(c: Catch): boolean {
  return needsCard(c.species) && c.kept === true;
}

/**
 * WDFW freshwater catch area codes, Puget Sound region. Three digits, assigned per water.
 * Only the waters this app points at are listed; anything else falls back to the code the user
 * types in, because guessing a code onto a legal document would be worse than leaving it blank.
 */
export const AREA_CODES: Record<string, string> = {
  'puyallup-river': '804',
  'white-river': '808',
  'stuck-river': '808',
  'carbon-river': '802',
  'nisqually-river': '786',
  'green-river': '746',
  'duwamish-river': '746',
};

const NAME_CODES: [RegExp, string][] = [
  [/\bpuyallup\b/i, '804'],
  [/\bwhite\b.*\briver\b|\bstuck\b/i, '808'],
  [/\bcarbon\b/i, '802'],
  [/\bnisqually\b/i, '786'],
  [/\b(green|duwamish)\b/i, '746'],
];

/** Best known code for a water, or null. Null means the field stays blank for the user to fill. */
export function areaCode(waterId: string | null | undefined, waterName: string | null | undefined): string | null {
  if (waterId && AREA_CODES[waterId]) return AREA_CODES[waterId];
  const n = waterName || '';
  for (const [re, code] of NAME_CODES) if (re.test(n)) return code;
  return null;
}

export interface CardRow {
  id: string;
  /** Catch area code, or null when the app does not know it. */
  area: string | null;
  month: number;
  day: number;
  species: SpeciesId;
  /** true hatchery (adipose clipped), false wild, null not recorded. */
  clipped: boolean | null;
  water: string;
  date: string;
}

/**
 * The license year runs April 1 to March 31, and the card is filed for that year, so a season
 * total has to be counted on those boundaries rather than on the calendar year.
 */
export function licenseYear(d = new Date()): { start: Date; end: Date; label: string } {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31), label: `${y}-${String(y + 1).slice(2)}` };
}

function inYear(dateStr: string, yr: ReturnType<typeof licenseYear>): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return false;
  const t = new Date(y, m - 1, d).getTime();
  return t >= yr.start.getTime() && t <= yr.end.getTime();
}

/** Every kept card fish in a license year, newest first, in card column order. */
export function cardRows(catches: Catch[], yr = licenseYear()): CardRow[] {
  return catches
    .filter(onCard)
    .filter(c => inYear(c.date, yr))
    .map(c => {
      const [, m, d] = c.date.split('-').map(Number);
      return {
        id: c.id,
        area: c.catch_area || areaCode(c.lake_id, c.lake_name),
        month: m,
        day: d,
        species: c.species as SpeciesId,
        clipped: c.clipped ?? null,
        water: c.lake_name || c.lake_id,
        date: c.date,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface CardTotals {
  total: number;
  bySpecies: Record<string, number>;
  /** Rows the app cannot fill in for you. */
  missingArea: number;
  missingClip: number;
}

export function cardTotals(rows: CardRow[]): CardTotals {
  const bySpecies: Record<string, number> = {};
  for (const r of rows) bySpecies[r.species] = (bySpecies[r.species] || 0) + 1;
  return {
    total: rows.length,
    bySpecies,
    missingArea: rows.filter(r => !r.area).length,
    missingClip: rows.filter(r => r.clipped === null).length,
  };
}

/**
 * Kept card fish logged but not yet marked as written on the paper card. The app cannot know what
 * is on the card, so this is simply the fish from today and yesterday, the window where forgetting
 * actually happens.
 */
export function unwritten(rows: CardRow[], now = new Date()): CardRow[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return rows.filter(r => {
    const [y, m, d] = r.date.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() >= cutoff.getTime();
  });
}

/** The card is due back April 30 for fish. Days left, or null outside the run-up. */
export function daysToDeadline(now = new Date()): number | null {
  const y = now.getMonth() >= 3 && !(now.getMonth() === 3 && now.getDate() <= 30) ? now.getFullYear() + 1 : now.getFullYear();
  const due = new Date(y, 3, 30);
  const days = Math.round((due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  return days >= 0 && days <= 45 ? days : null;
}

/** One row as it reads on the card, for copying across. */
export function rowText(r: CardRow): string {
  const clip = r.clipped === true ? 'Hatchery' : r.clipped === false ? 'Wild' : '(clip?)';
  return `${r.area || '(area?)'}  ${r.month}/${r.day}  ${r.species}  ${clip}`;
}

export function cardCsv(rows: CardRow[]): string {
  const head = 'catch_area,month,day,species,clip,water,date';
  const body = rows.map(r => [r.area || '', r.month, r.day, r.species, r.clipped === true ? 'hatchery' : r.clipped === false ? 'wild' : '', `"${r.water.replace(/"/g, '""')}"`, r.date].join(','));
  return [head, ...body].join('\n');
}
