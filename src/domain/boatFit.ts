import type { Lake, Launch } from '@/lib/types';

/**
 * Seri runs two boats: a small electric-motor boat and a 17 ft aluminum with a 40 hp outboard.
 * This turns WDFW ramp, motor, and size data into a plain answer for each lake.
 */
export type BoatFit = 'big' | 'small' | 'shore' | 'hike';

export const BIG_BOAT_MIN_ACRES = 40;

export interface BoatFitResult {
  fit: BoatFit;
  label: string;
  detail: string;
}

export function boatFit(l: Lake, launch?: Launch | null): BoatFitResult {
  if (l.kind === 'high') return { fit: 'hike', label: 'Hike-in', detail: `Alpine lake at ${l.elev.toLocaleString()} ft. Pack rod and float tube.` };
  const ramp = l.ramp === true || !!launch;
  const motor = launch ? launch.motor : null;
  const acres = l.acres || 0;
  if (ramp && motor !== false && acres >= BIG_BOAT_MIN_ACRES) {
    return { fit: 'big', label: '17 ft gas boat', detail: `Ramp${launch?.name ? ` at ${launch.name}` : ''}, ${motor === true ? 'motors allowed' : 'motor rules not listed'}, ${Math.round(acres).toLocaleString()} acres.${launch?.hp ? ` HP limit ${launch.hp}.` : ''}` };
  }
  if (ramp && motor === false) return { fit: 'small', label: 'Electric boat', detail: `Ramp but no gas motors at ${launch?.name || 'the launch'}. Take the small boat.` };
  if (ramp) return { fit: 'small', label: 'Electric boat', detail: `Ramp on ${Math.round(acres).toLocaleString()} acres. Small water, small boat.` };
  if (l.shore === 'good') return { fit: 'shore', label: 'Shore or car-top', detail: 'No WDFW ramp listed. Shore access is good; a car-topper or float tube works.' };
  return { fit: 'shore', label: 'No ramp', detail: 'No WDFW ramp or shore access listed. Check the WDFW page before driving out.' };
}

export const MGMT_LABEL: Record<string, string> = {
  'Trout emphasis': 'Trout water',
  'Mixed species - Trout emphasis': 'Mixed, trout first',
  'Mixed species - Warmwater emphasis': 'Mixed, warmwater first',
  'Warmwater emphasis': 'Warmwater',
  'Fish Stocking': 'Stocked high lake',
  'Overabundant Lakes': 'Overabundant, keep some',
  'Getting Started Lakes': 'Easy first high lake',
};

export function mgmtLabel(m: string): string { return MGMT_LABEL[m] || m || ''; }
