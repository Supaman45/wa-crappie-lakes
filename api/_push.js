import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

/**
 * Shared push plumbing. Needs these Vercel environment variables:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   web push identity (generate once with web-push)
 *   VAPID_SUBJECT                          mailto:you@example.com
 *   SUPABASE_SERVICE_ROLE_KEY              server-only key for reading every subscription
 *   CRON_SECRET                            Vercel sends it on cron calls; anything long and random
 */
export const SB_URL = process.env.SUPABASE_URL || 'https://ptdsxxttsyfczoacyyqg.supabase.co';
export const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_BrWe4LtnNnAI1_v_evwP3w_aBUIOmEz';

export function pushReady() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function missingEnv() {
  return ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:strong.serimon@gmail.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
}

export function admin() {
  return createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Who is calling, from the Supabase access token in the Authorization header. */
export async function userFromRequest(req) {
  const h = req.headers?.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const sb = createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Send one notification to a list of subscription rows. Drops rows the push service says are gone.
 * payload: { title, body, url, tag }
 */
export async function sendToAll(rows, payload) {
  configure();
  const db = admin();
  const body = JSON.stringify(payload);
  let sent = 0, gone = 0, failed = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, { TTL: 60 * 60 * 12, urgency: 'normal' });
      sent++;
      await db.from('push_subscriptions').update({ last_ok: new Date().toISOString(), fails: 0 }).eq('id', r.id);
    } catch (e) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) { gone++; await db.from('push_subscriptions').delete().eq('id', r.id); }
      else { failed++; await db.from('push_subscriptions').update({ fails: (r.fails || 0) + 1 }).eq('id', r.id); }
    }
  }));
  return { sent, gone, failed };
}
