// Geometry for the North Beach driving map. Pure data and logic, no Leaflet.
//
// Every closure boundary comes from WAC 352-37-060. Point sources:
// - Approach roads: the seaward end of each approach from OpenStreetMap (see APPROACHES in coast.ts),
//   shifted roughly 350 m west to the wet sand, since the asphalt ends behind the dunes.
// - North Jetty (46.92676, -124.17740), Copalis Rock (47.14897, -124.19434) and the Boone Creek
//   mouth (47.15897, -124.19129): USGS GNIS.
// - Copalis River mouth (47.14085, -124.18541): OpenStreetMap, as used in v3.6.3.
// - Ocean City access and the Quinault line: approximate. The rule names the Ocean City approach
//   without a surveyed point, and the reservation boundary meets the beach near the Moclips River.
//   Both are flagged in the popup.
import { SEGMENTS, APPROACHES, type DriveStatus } from './coast';

/** Beach line, south to north: [lat, lng] on the sand, used to draw each band along the shore. */
const SHORE: [number, number][] = [
  [46.9300, -124.1800], // north side of the North Jetty
  [46.9526, -124.1750], // Marine View Dr
  [46.9724, -124.1785], // Taurus Blvd
  [46.9836, -124.1782], // Ocean Lake approach
  [46.9939, -124.1745], // Pacific Way
  [47.0072, -124.1730], // Chance a la Mer
  [47.0700, -124.1796], // Ocean City access (approximate)
  [47.1113, -124.1841], // Heath Rd
  [47.1142, -124.1846], // Benner Gap
  [47.1409, -124.1890], // Copalis River mouth
  [47.1490, -124.1920], // Copalis Rock
  [47.1590, -124.1950], // Boone Creek
  [47.1754, -124.2008], // Roosevelt Beach
  [47.2190, -124.2128], // Annelyde Gap
  [47.2391, -124.2215], // Moclips, 2nd St
  [47.2465, -124.2245], // Quinault Indian Reservation line (approximate)
];

/** The shoreline between two latitudes, with interpolated end points so bands meet exactly. */
export function shoreBetween(fromLat: number, toLat: number): [number, number][] {
  const lngAt = (lat: number): number => {
    for (let i = 0; i < SHORE.length - 1; i++) {
      const [a, alng] = SHORE[i], [b, blng] = SHORE[i + 1];
      if (lat >= a && lat <= b) return alng + (blng - alng) * ((lat - a) / (b - a));
    }
    return lat < SHORE[0][0] ? SHORE[0][1] : SHORE[SHORE.length - 1][1];
  };
  const pts: [number, number][] = [[fromLat, lngAt(fromLat)]];
  for (const p of SHORE) if (p[0] > fromLat && p[0] < toLat) pts.push(p);
  pts.push([toLat, lngAt(toLat)]);
  return pts;
}

export type BandKind = 'open' | 'seasonal' | 'allYear';
export interface Band { id: string; kind: BandKind; name: string; from: number; to: number; approx?: boolean }

const seg = (id: string) => SEGMENTS.find(s => s.id === id)!.name;

/** South to north, edge to edge, so the bands tile the whole beach with no gaps. */
export const BANDS: Band[] = [
  { id: 'jetty', kind: 'seasonal', name: seg('jetty'), from: 46.9300, to: 46.9526 },
  { id: 'open-os', kind: 'open', name: 'Marine View Dr to Pacific Way', from: 46.9526, to: 46.9939 },
  { id: 'pacific', kind: 'seasonal', name: seg('pacific'), from: 46.9939, to: 47.0072 },
  { id: 'open-chance', kind: 'open', name: 'Chance a la Mer to the Ocean City access', from: 47.0072, to: 47.0700, approx: true },
  { id: 'oceancity', kind: 'seasonal', name: seg('oceancity'), from: 47.0700, to: 47.0961, approx: true },
  { id: 'open-copalis', kind: 'open', name: 'Ocean City +1.8 mi to Benner Gap', from: 47.0961, to: 47.1142, approx: true },
  { id: 'benner', kind: 'allYear', name: seg('benner'), from: 47.1142, to: 47.1409 },
  { id: 'open-river', kind: 'open', name: 'Copalis River to Copalis Rock', from: 47.1409, to: 47.1490 },
  { id: 'rock', kind: 'seasonal', name: seg('rock'), from: 47.1490, to: 47.1590 },
  { id: 'open-boone', kind: 'open', name: 'Boone Creek to Roosevelt Beach', from: 47.1590, to: 47.1754 },
  { id: 'roosevelt', kind: 'seasonal', name: seg('roosevelt'), from: 47.1754, to: 47.2190 },
  { id: 'open-pb', kind: 'open', name: 'Annelyde Gap to Moclips', from: 47.2190, to: 47.2391 },
  { id: 'moclips', kind: 'seasonal', name: seg('moclips'), from: 47.2391, to: 47.2465, approx: true },
];

export type BandState = 'drive' | 'closed' | 'foot';
export function bandState(b: Band, st: DriveStatus): BandState {
  if (b.kind === 'allYear') return 'foot';
  if (b.kind === 'seasonal' && st.closed) return 'closed';
  return 'drive';
}

const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

/** One line for the popup: what this sand means today, and when that changes. */
export function bandText(b: Band, st: DriveStatus): string {
  if (b.kind === 'allYear') return 'Closed to vehicles all year. Open to you on foot.';
  if (b.kind === 'open') return 'Open to vehicles all year.';
  return st.closed ? `Closed to vehicles until ${fmt(st.until)}. Open on foot.` : `Open to vehicles until ${fmt(st.until)}.`;
}

/** Approach pins with coordinates; Ocean City has no clean OSM road, so it sits on the band edge. */
export function approachPins(): { id: string; name: string; town: string; lat: number; lng: number; walk: boolean; exact: boolean; place?: string }[] {
  return APPROACHES.map(a => {
    if (a.lat != null && a.lng != null) return { id: a.id, name: a.name, town: a.town, lat: a.lat, lng: a.lng, walk: a.access === 'walk', exact: true };
    return { id: a.id, name: a.name, town: a.town, lat: 47.0700, lng: -124.1760, walk: false, exact: false, place: a.place };
  });
}

/** The approach pins on either side of a band: where to get on the sand nearest to it. */
export function nearestApproaches(b: Band): ReturnType<typeof approachPins> {
  const pins = approachPins().slice().sort((x, y) => x.lat - y.lat);
  const south = pins.filter(p => p.lat <= b.from + 0.0015).pop();
  const north = pins.find(p => p.lat >= b.to - 0.0015);
  return [south, north].filter((p, i, arr): p is NonNullable<typeof p> => !!p && arr.findIndex(q => q?.id === p.id) === i);
}

export function wazeUrl(p: { lat: number; lng: number; exact: boolean; place?: string; name: string; town: string }): string {
  if (!p.exact) return `https://waze.com/ul?q=${encodeURIComponent(p.place || `${p.name}, ${p.town}, WA`)}&navigate=yes`;
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}
