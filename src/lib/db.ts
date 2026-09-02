import Dexie, { type Table } from 'dexie';
import type { Catch, Visit, Trip, LakeTag, Profile, Spot, OutboxItem, Launch } from './types';

interface KV { key: string; value: unknown; at: number; }

/** IndexedDB cache so the app opens with data at the lake with no signal. */
class FishDB extends Dexie {
  catches!: Table<Catch, string>;
  visits!: Table<Visit, string>;
  trips!: Table<Trip, string>;
  tags!: Table<LakeTag & { key: string }, string>;
  profiles!: Table<Profile, string>;
  spots!: Table<Spot, string>;
  outbox!: Table<OutboxItem, string>;
  kv!: Table<KV, string>;
  launches!: Table<Launch & { key: string }, string>;

  constructor() {
    super('wa-fish-finder');
    this.version(1).stores({
      catches: 'id, user_id, lake_id, date',
      visits: 'id, user_id, lake_id, date',
      trips: 'id, user_id, started_at',
      tags: 'key, user_id, lake_id',
      profiles: 'id',
      spots: 'id, user_id, kind, status',
      outbox: 'id, kind, created_at',
      kv: 'key',
      launches: 'key',
    });
  }
}

export const db = new FishDB();

export async function kvGet<T>(key: string, maxAgeMs?: number): Promise<T | null> {
  try {
    const row = await db.kv.get(key);
    if (!row) return null;
    if (maxAgeMs != null && Date.now() - row.at > maxAgeMs) return null;
    return row.value as T;
  } catch { return null; }
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  try { await db.kv.put({ key, value, at: Date.now() }); } catch { /* storage may be unavailable */ }
}

export function tagKey(userId: string, lakeId: string): string { return `${userId}:${lakeId}`; }
