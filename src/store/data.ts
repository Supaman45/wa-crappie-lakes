import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb, fetchAll, PHOTO_BUCKET } from '@/lib/supabase';
import { db, tagKey } from '@/lib/db';
import { uuid, isOnline, todayStr, downscale, normTrack } from '@/lib/util';
import { toast } from '@/lib/toast';
import type { Catch, Visit, Trip, LakeTag, Profile, Spot, OutboxItem } from '@/lib/types';

export interface LogStats { visits: number; catches: number; sp: Record<string, number>; top: string | null; lastDate: string | null; }

interface DataState {
  loaded: boolean;
  syncing: boolean;
  online: boolean;
  catches: Catch[];
  visits: Visit[];
  trips: Trip[];
  tags: Record<string, LakeTag>;       // key user:lake
  profiles: Record<string, Profile>;
  spots: Spot[];
  outboxCount: number;
  stuckCount: number;
  index: Record<string, LogStats>;     // keyed by lake slug or spot id

  boot: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  flush: () => Promise<void>;
  teardown: () => void;

  saveCatch: (c: Partial<Catch> & { lake_id: string }, photo?: Blob | null) => Promise<Catch>;
  deleteCatch: (id: string) => Promise<void>;
  logVisit: (lakeId: string, lakeName: string, waterType?: Catch['water_type'], spotId?: string | null, date?: string) => Promise<boolean>;
  setTag: (lakeId: string, patch: Partial<LakeTag>) => Promise<void>;
  saveTrip: (t: Partial<Trip>) => Promise<Trip>;
  saveSpot: (s: Partial<Spot> & { name: string; lat: number; lng: number }) => Promise<Spot>;
  updateSpot: (id: string, patch: Partial<Spot>) => Promise<void>;
  deleteSpot: (id: string) => Promise<void>;
  updateProfile: (name: string, color?: string) => Promise<void>;
  myTag: (lakeId: string) => LakeTag | undefined;
  crewTags: (lakeId: string) => LakeTag[];
}

let me: string | null = null;
let channel: RealtimeChannel | null = null;
let flushing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function buildIndex(catches: Catch[], visits: Visit[]): Record<string, LogStats> {
  const idx: Record<string, LogStats> = {};
  const get = (k: string) => idx[k] || (idx[k] = { visits: 0, catches: 0, sp: {}, top: null, lastDate: null });
  for (const v of visits) { const x = get(v.lake_id); x.visits++; if (!x.lastDate || v.date > x.lastDate) x.lastDate = v.date; }
  for (const c of catches) {
    const x = get(c.lake_id); const q = c.qty || 1; x.catches += q;
    const s = c.species || 'crappie'; x.sp[s] = (x.sp[s] || 0) + q;
    if (!x.lastDate || c.date > x.lastDate) x.lastDate = c.date;
  }
  for (const k in idx) { let best: string | null = null, bn = 0; for (const s in idx[k].sp) if (idx[k].sp[s] > bn) { bn = idx[k].sp[s]; best = s; } idx[k].top = best; }
  return idx;
}

async function cacheAll(s: Pick<DataState, 'catches' | 'visits' | 'trips' | 'tags' | 'profiles' | 'spots'>) {
  try {
    await db.transaction('rw', [db.catches, db.visits, db.trips, db.tags, db.profiles, db.spots], async () => {
      await db.catches.clear(); await db.catches.bulkPut(s.catches);
      await db.visits.clear(); await db.visits.bulkPut(s.visits);
      await db.trips.clear(); await db.trips.bulkPut(s.trips);
      await db.tags.clear(); await db.tags.bulkPut(Object.entries(s.tags).map(([key, t]) => ({ ...t, key })));
      await db.profiles.clear(); await db.profiles.bulkPut(Object.values(s.profiles));
      await db.spots.clear(); await db.spots.bulkPut(s.spots);
    });
  } catch { /* cache is best effort */ }
}

function classify(err: unknown): 'retry' | 'drop' {
  const code = (err as { code?: string })?.code || '';
  const msg = String((err as { message?: string })?.message || err || '');
  if (code === '23505') return 'drop';                     // duplicate: already there
  if (code === '23503' || code === '22P02' || code === '42501' || /row-level security/i.test(msg)) return 'drop';
  return 'retry';
}

export const useData = create<DataState>((set, get) => ({
  loaded: false, syncing: false, online: isOnline(),
  catches: [], visits: [], trips: [], tags: {}, profiles: {}, spots: [], outboxCount: 0, stuckCount: 0, index: {},

  boot: async (userId) => {
    me = userId;
    // 1. cached data first
    try {
      const [catches, visits, trips, tags, profiles, spots, outbox] = await Promise.all([
        db.catches.toArray(), db.visits.toArray(), db.trips.toArray(), db.tags.toArray(), db.profiles.toArray(), db.spots.toArray(), db.outbox.toArray(),
      ]);
      const tagMap: Record<string, LakeTag> = {}; for (const t of tags) { const { key, ...rest } = t; tagMap[key] = rest; }
      const profMap: Record<string, Profile> = {}; for (const p of profiles) profMap[p.id] = p;
      if (catches.length || visits.length || spots.length) {
        set({ catches, visits, trips: trips.map(t => ({ ...t, track: normTrack(t.track) })), tags: tagMap, profiles: profMap, spots, loaded: true, index: buildIndex(catches, visits), outboxCount: outbox.length, stuckCount: outbox.filter(o => o.attempts >= 5).length });
      }
    } catch { /* no cache */ }
    // 2. network
    await get().flush();
    await get().refresh();
    // 3. realtime
    if (channel) sb.removeChannel(channel);
    const bump = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => get().refresh(), 800); };
    channel = sb.channel('wff-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catches' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lake_tags' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, bump)
      .subscribe();
    window.addEventListener('online', () => { set({ online: true }); get().flush().then(() => get().refresh()); });
    window.addEventListener('offline', () => set({ online: false }));
  },

  refresh: async () => {
    if (!isOnline()) return;
    set({ syncing: true });
    try {
      const [catches, visits, trips, tagRows, profRows, spots] = await Promise.all([
        fetchAll<Catch>('catches', 'created_at'), fetchAll<Visit>('visits', 'created_at'), fetchAll<Trip>('trips', 'created_at'),
        fetchAll<LakeTag>('lake_tags', 'updated_at'), fetchAll<Profile>('profiles', 'created_at', true), fetchAll<Spot>('spots', 'created_at'),
      ]);
      // keep unsynced local rows visible
      const pending = await db.outbox.toArray();
      const pendIds = new Set(pending.map(p => p.id));
      const cur = get();
      const merged = <T extends { id: string; _local?: boolean }>(remote: T[], local: T[]) => [...local.filter(l => l._local && pendIds.has(l.id) && !remote.some(r => r.id === l.id)), ...remote];
      const tags: Record<string, LakeTag> = {}; for (const t of tagRows) tags[tagKey(t.user_id, t.lake_id)] = t;
      const profiles: Record<string, Profile> = {}; for (const p of profRows) profiles[p.id] = p;
      const next = { catches: merged(catches, cur.catches), visits: merged(visits, cur.visits), trips: merged(trips, cur.trips).map(t => ({ ...t, track: normTrack(t.track) })), tags, profiles, spots: merged(spots, cur.spots) };
      set({ ...next, loaded: true, index: buildIndex(next.catches, next.visits), outboxCount: pending.length, stuckCount: pending.filter(o => o.attempts >= 5).length });
      cacheAll(next);
    } catch (e) {
      console.warn('refresh failed', e);
    } finally { set({ syncing: false }); }
  },

  flush: async () => {
    if (flushing || !isOnline() || !me) return;
    flushing = true;
    try {
      const items = await db.outbox.orderBy('created_at').toArray();
      for (const it of items) {
        if (it.attempts >= 5) continue;
        try {
          if (it.kind === 'catch') { const { error } = await sb.from('catches').insert(it.payload); if (error) throw error; }
          else if (it.kind === 'visit') { const { error } = await sb.from('visits').insert(it.payload); if (error) throw error; }
          else if (it.kind === 'trip') { const { error } = await sb.from('trips').insert(it.payload); if (error) throw error; }
          else if (it.kind === 'spot') { const { error } = await sb.from('spots').insert(it.payload); if (error) throw error; }
          else if (it.kind === 'spot_update') { const { id, ...patch } = it.payload as { id: string }; const { error } = await sb.from('spots').update(patch).eq('id', id); if (error) throw error; }
          else if (it.kind === 'tag') { const { error } = await sb.from('lake_tags').upsert(it.payload, { onConflict: 'user_id,lake_id' }); if (error) throw error; }
          await db.outbox.delete(it.id);
        } catch (e) {
          if (classify(e) === 'drop') { await db.outbox.delete(it.id); }
          else { await db.outbox.update(it.id, { attempts: it.attempts + 1, last_error: String((e as Error)?.message || e) }); }
        }
      }
      const left = await db.outbox.toArray();
      set({ outboxCount: left.length, stuckCount: left.filter(o => o.attempts >= 5).length });
      if (items.length && left.length < items.length) toast(`Synced ${items.length - left.length} saved item${items.length - left.length === 1 ? '' : 's'}`);
    } finally { flushing = false; }
  },

  teardown: () => { if (channel) { sb.removeChannel(channel); channel = null; } },

  saveCatch: async (input, photo) => {
    if (!me) throw new Error('Not signed in');
    const id = input.id || uuid();
    let photo_path: string | null = input.photo_path ?? null;
    if (photo && isOnline()) {
      try {
        const blob = await downscale(photo);
        const path = `${me}/${uuid()}.jpg`;
        const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        photo_path = path;
      } catch (e) { toast('Photo upload failed, saving catch without it', 'warn'); }
    }
    const row: Catch = {
      id, user_id: me, lake_id: input.lake_id, lake_name: input.lake_name ?? null, species: input.species || 'crappie', date: input.date || todayStr(),
      length: input.length ?? null, weight: input.weight ?? null, qty: input.qty ?? 1, notes: input.notes ?? null, photo_path,
      depth: input.depth ?? null, bait: input.bait ?? null, structure: input.structure ?? null, water_temp: input.water_temp ?? null,
      water_type: input.water_type || 'lake', spot_id: input.spot_id ?? null, created_at: new Date().toISOString(),
    };
    const { _local, ...payload } = { ...row, _local: undefined };
    let saved = false;
    if (isOnline()) {
      const { error } = await sb.from('catches').insert(payload);
      if (!error) saved = true; else if (classify(error) === 'drop') throw error;
    }
    if (!saved) { await db.outbox.put({ id, kind: 'catch', payload, created_at: Date.now(), attempts: 0 }); row._local = true; toast('Saved offline, will sync', 'warn'); }
    const catches = [row, ...get().catches];
    set({ catches, index: buildIndex(catches, get().visits), outboxCount: saved ? get().outboxCount : get().outboxCount + 1 });
    db.catches.put(row).catch(() => {});
    if (saved) get().refresh();
    return row;
  },

  deleteCatch: async (id) => {
    const c = get().catches.find(x => x.id === id);
    await db.outbox.delete(id);                              // if it was never synced, dropping the outbox row is the delete
    if (c && !c._local && isOnline()) {
      const { error } = await sb.from('catches').delete().eq('id', id);
      if (error) { toast('Delete failed: ' + error.message, 'err'); return; }
      if (c.photo_path) sb.storage.from(PHOTO_BUCKET).remove([c.photo_path]).then(() => {}, () => {});
    } else if (c && !c._local) { toast('Go online to delete synced catches', 'warn'); return; }
    const catches = get().catches.filter(x => x.id !== id);
    set({ catches, index: buildIndex(catches, get().visits) });
    db.catches.delete(id).catch(() => {});
    const left = await db.outbox.count(); set({ outboxCount: left });
  },

  logVisit: async (lakeId, lakeName, waterType = 'lake', spotId = null, date) => {
    if (!me) return false;
    const d = date || todayStr();
    if (get().visits.some(v => v.user_id === me && v.lake_id === lakeId && v.date === d)) return false;
    const id = uuid();
    const row: Visit = { id, user_id: me, lake_id: lakeId, lake_name: lakeName, date: d, water_type: waterType, spot_id: spotId, created_at: new Date().toISOString() };
    let saved = false;
    if (isOnline()) {
      const { error } = await sb.from('visits').insert(row);
      if (!error) saved = true; else if (error.code === '23505') return false; else if (classify(error) === 'drop') { toast(error.message, 'err'); return false; }
    }
    if (!saved) { await db.outbox.put({ id, kind: 'visit', payload: row as unknown as Record<string, unknown>, created_at: Date.now(), attempts: 0 }); row._local = true; }
    const visits = [row, ...get().visits];
    set({ visits, index: buildIndex(get().catches, visits), outboxCount: saved ? get().outboxCount : get().outboxCount + 1 });
    db.visits.put(row).catch(() => {});
    return true;
  },

  setTag: async (lakeId, patch) => {
    if (!me) return;
    const key = tagKey(me, lakeId);
    const prev = get().tags[key] || { user_id: me, lake_id: lakeId, fav: false, wish: false, color: null, cat: null };
    const next: LakeTag = { ...prev, ...patch, user_id: me, lake_id: lakeId, updated_at: new Date().toISOString() };
    set({ tags: { ...get().tags, [key]: next } });
    db.tags.put({ ...next, key }).catch(() => {});
    if (isOnline()) {
      const { error } = await sb.from('lake_tags').upsert(next, { onConflict: 'user_id,lake_id' });
      if (!error) return;
    }
    await db.outbox.put({ id: 'tag:' + key, kind: 'tag', payload: next as unknown as Record<string, unknown>, created_at: Date.now(), attempts: 0 });
    set({ outboxCount: await db.outbox.count() });
  },

  saveTrip: async (t) => {
    if (!me) throw new Error('Not signed in');
    const id = t.id || uuid();
    const row: Trip = { id, user_id: me, started_at: t.started_at ?? null, ended_at: t.ended_at ?? null, duration_min: t.duration_min ?? null, distance_mi: t.distance_mi ?? null, track: t.track ?? null, lakes: t.lakes ?? null, catch_ids: t.catch_ids ?? null, note: t.note ?? null, created_at: new Date().toISOString() };
    let saved = false;
    if (isOnline()) { const { error } = await sb.from('trips').insert(row); if (!error) saved = true; else if (error.code === '23505') saved = true; }
    if (!saved) { await db.outbox.put({ id, kind: 'trip', payload: row as unknown as Record<string, unknown>, created_at: Date.now(), attempts: 0 }); row._local = true; toast('Trip saved offline, will sync', 'warn'); }
    set({ trips: [row, ...get().trips], outboxCount: saved ? get().outboxCount : get().outboxCount + 1 });
    db.trips.put(row).catch(() => {});
    return row;
  },

  saveSpot: async (s) => {
    if (!me) throw new Error('Not signed in');
    const id = s.id || uuid();
    const now = new Date().toISOString();
    const row: Spot = { id, user_id: me, kind: s.kind || 'creek', name: s.name, lat: s.lat, lng: s.lng, llid: s.llid ?? null, species: s.species || [], meta: s.meta || {}, access: s.access || 'unknown', permit: s.permit ?? null, priority: s.priority ?? 3, status: s.status || 'candidate', notes: s.notes ?? null, created_at: now, updated_at: now };
    let saved = false;
    if (isOnline()) { const { error } = await sb.from('spots').insert(row); if (!error) saved = true; else if (classify(error) === 'drop') throw error; }
    if (!saved) { await db.outbox.put({ id, kind: 'spot', payload: row as unknown as Record<string, unknown>, created_at: Date.now(), attempts: 0 }); row._local = true; toast('Spot saved offline, will sync', 'warn'); }
    set({ spots: [row, ...get().spots], outboxCount: saved ? get().outboxCount : get().outboxCount + 1 });
    db.spots.put(row).catch(() => {});
    return row;
  },

  updateSpot: async (id, patch) => {
    const spots = get().spots.map(s => s.id === id ? { ...s, ...patch, updated_at: new Date().toISOString() } : s);
    set({ spots });
    const row = spots.find(s => s.id === id); if (row) db.spots.put(row).catch(() => {});
    const { _local, id: _i, user_id, created_at, updated_at, ...clean } = patch as Spot;
    if (isOnline()) { const { error } = await sb.from('spots').update(clean).eq('id', id); if (!error) return; }
    await db.outbox.put({ id: 'spotu:' + id + ':' + Date.now(), kind: 'spot_update', payload: { id, ...clean }, created_at: Date.now(), attempts: 0 });
    set({ outboxCount: await db.outbox.count() });
  },

  deleteSpot: async (id) => {
    await db.outbox.delete(id);
    if (isOnline()) { const { error } = await sb.from('spots').delete().eq('id', id); if (error) { toast('Delete failed: ' + error.message, 'err'); return; } }
    else { toast('Go online to delete a synced spot', 'warn'); return; }
    set({ spots: get().spots.filter(s => s.id !== id) });
    db.spots.delete(id).catch(() => {});
  },

  updateProfile: async (name, color) => {
    if (!me) return;
    const patch: Partial<Profile> = { name }; if (color) patch.color = color;
    const { error } = await sb.from('profiles').update(patch).eq('id', me);
    if (error) { toast('Name update failed: ' + error.message, 'err'); return; }
    const p = get().profiles[me] || { id: me, name, color: '#4cc6e0' };
    set({ profiles: { ...get().profiles, [me]: { ...p, ...patch } } });
    toast('Profile updated');
  },

  myTag: (lakeId) => me ? get().tags[tagKey(me, lakeId)] : undefined,
  crewTags: (lakeId) => Object.values(get().tags).filter(t => t.lake_id === lakeId && t.user_id !== me && (t.fav || t.wish || t.cat)),
}));

export function currentUserId(): string | null { return me; }
