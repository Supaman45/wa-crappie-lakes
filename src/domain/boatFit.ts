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
  if (l.kind === 'high') return { fit: 'hike', label: 'Hike-in', detail: `${l.state === 'OR' ? 'Probably a hike-in: small, high, trout only' : 'Alpine lake'} at ${l.elev.toLocaleString()} ft. Pack rod and float tube.` };
  const ramp = l.ramp === true || !!launch;
  const motor = launch ? launch.motor : null;
  const acres = l.acres || 0;
  if (ramp && motor !== false && acres >= BIG_BOAT_MIN_ACRES) {
    return { fit: 'big', label: '17 ft gas boat', detail: `Ramp${launch?.name ? ` at ${launch.name}` : ''}, ${motor === true ? 'motors allowed' : 'motor rules not listed'}, ${Math.round(acres).toLocaleString()} acres.${launch?.hp ? ` HP limit ${launch.hp}.` : ''}` };
  }
  if (ramp && motor === false) return { fit: 'small', label: 'Electric boat', detail: `Ramp but no gas motors at ${launch?.name || 'the launch'}. Take the small boat.` };
  if (ramp) return { fit: 'small', label: 'Electric boat', detail: `Ramp on ${Math.round(acres).toLocaleString()} acres. Small water, small boat.` };
  if (l.state === 'OR') {
    // No Oregon ramp data yet, so size is the only clue. Never claim "no ramp" here.
    if (acres >= 300) return { fit: 'shore', label: 'Ramp likely', detail: `${Math.round(acres).toLocaleString()} acres usually means a ramp, but the app has no Oregon ramp data yet. Check the map for the ramp road before you tow the 17 ft.` };
    return { fit: 'shore', label: 'Ramp unknown', detail: 'The app has no Oregon ramp data yet. Plan on the small boat or the bank until you confirm a ramp.' };
  }
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
