import type { SpeciesId } from '@/lib/types';

export interface SpeciesDef { id: SpeciesId; name: string; short: string; color: string; swifd?: string[]; }

export const SPECIES: SpeciesDef[] = [
  { id: 'crappie', name: 'Black crappie', short: 'Crappie', color: '#4fb477' },
  { id: 'largemouth', name: 'Largemouth bass', short: 'Largemouth', color: '#4c84d6', swifd: ['Largemouth Bass'] },
  { id: 'smallmouth', name: 'Smallmouth bass', short: 'Smallmouth', color: '#c97f3a', swifd: ['Smallmouth Bass'] },
  { id: 'cutthroat', name: 'Cutthroat trout', short: 'Cutthroat', color: '#e0913f', swifd: ['Cutthroat Trout', 'Westslope Cutthroat Trout'] },
  { id: 'rainbow', name: 'Rainbow trout', short: 'Rainbow', color: '#e06fb0', swifd: ['Rainbow Trout'] },
  { id: 'coho', name: 'Coho salmon', short: 'Coho', color: '#52c9e2', swifd: ['Coho Salmon'] },
  { id: 'steelhead', name: 'Steelhead', short: 'Steelhead', color: '#9b6fe0', swifd: ['Steelhead Trout'] },
  { id: 'chinook', name: 'Chinook salmon', short: 'Chinook', color: '#e0533d', swifd: ['Chinook Salmon'] },
  { id: 'bull', name: 'Bull trout', short: 'Bull trout', color: '#7a8a99', swifd: ['Bull Trout'] },
  { id: 'brook', name: 'Eastern brook trout', short: 'Brook', color: '#5bbf6a', swifd: ['Eastern Brook Trout'] },
  { id: 'brown', name: 'Brown trout', short: 'Brown', color: '#b8863b' },
  { id: 'tiger', name: 'Tiger trout', short: 'Tiger trout', color: '#d9a441' },
  { id: 'golden', name: 'Golden trout', short: 'Golden', color: '#f0c419' },
  { id: 'kokanee', name: 'Kokanee', short: 'Kokanee', color: '#e8574d' },
  { id: 'laker', name: 'Lake trout', short: 'Lake trout', color: '#8fa3b8' },
  { id: 'cutbow', name: 'Rainbow x cutthroat', short: 'Cutbow', color: '#e58fb0' },
  { id: 'walleye', name: 'Walleye', short: 'Walleye', color: '#d6c34a' },
  { id: 'muskie', name: 'Tiger muskie', short: 'Muskie', color: '#7fa86a' },
  { id: 'perch', name: 'Yellow perch', short: 'Perch', color: '#e7b93c' },
  { id: 'bluegill', name: 'Bluegill', short: 'Bluegill', color: '#5aa0d8' },
  { id: 'pumpkinseed', name: 'Pumpkinseed', short: 'Pumpkinseed', color: '#e0813f' },
  { id: 'bullhead', name: 'Brown bullhead', short: 'Bullhead', color: '#9a7b5f' },
  { id: 'other', name: 'Other', short: 'Other', color: '#8fa79e' },
];

export const spById: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const LAKE_SPECIES: SpeciesId[] = ['crappie', 'largemouth', 'smallmouth', 'rainbow', 'cutthroat', 'brown', 'brook', 'tiger', 'golden', 'kokanee', 'walleye', 'muskie', 'perch', 'bluegill', 'pumpkinseed', 'bullhead'];
/** The three the app started with; used for the map legend and pin colors. */
export const CORE_LAKE_SPECIES: SpeciesId[] = ['crappie', 'largemouth', 'smallmouth', 'rainbow', 'cutthroat'];
export const CREEK_SPECIES: SpeciesId[] = ['cutthroat', 'rainbow', 'coho', 'steelhead', 'chinook', 'bull', 'brook'];

/** Map a SWIFD SPECIES string to an app species id. */
export function speciesFromSwifd(name: string): SpeciesId {
  for (const s of SPECIES) if (s.swifd && s.swifd.includes(name)) return s.id;
  return 'other';
}
export function speciesColor(id: string): string { return spById[id]?.color || '#8fa79e'; }
export function speciesLabel(id: string): string { return spById[id]?.short || id; }

export const CATS = ['Honey hole', 'Producer', 'Scouting', 'Crowded', 'Skip'] as const;
export const SWATCHES = ['#e0533d', '#e0913f', '#e6c43d', '#5bbf6a', '#4c84d6', '#9b6fe0', '#e06fb0', '#7a8a99'];
export const BAITS = ['Jig', 'Minnow', 'Crappie tube', 'Beetle spin', 'Spinner', 'Worm', 'Fly', 'Spoon', 'Plug', 'Other'];
export const STRUCTURE = ['Brush', 'Dock', 'Weed edge', 'Drop-off', 'Timber', 'Open water', 'Inlet', 'Pool', 'Riffle', 'Undercut bank', 'Log jam', 'Other'];
