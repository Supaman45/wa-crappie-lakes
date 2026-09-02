import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://ptdsxxttsyfczoacyyqg.supabase.co';
export const SB_KEY = 'sb_publishable_BrWe4LtnNnAI1_v_evwP3w_aBUIOmEz';

export const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const PHOTO_BUCKET = 'catch-photos';
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Page through a table in 1000-row chunks so nothing gets silently truncated. */
export async function fetchAll<T>(table: string, order = 'created_at', ascending = false): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(table).select('*').order(order, { ascending }).range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < page) break;
  }
  return out;
}
