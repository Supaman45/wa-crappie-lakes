import { json, fail } from './_util.js';
import { pushReady, missingEnv, admin, userFromRequest, sendToAll } from './_push.js';

/** Send a test notification to every device the signed-in user has subscribed. */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return fail(res, new Error('POST only'), 405);
    if (!pushReady()) return fail(res, new Error('Push is not set up on the server. Missing: ' + missingEnv().join(', ')), 503);
    const user = await userFromRequest(req);
    if (!user) return fail(res, new Error('Sign in first'), 401);
    const { data, error } = await admin().from('push_subscriptions').select('*').eq('user_id', user.id);
    if (error) throw error;
    if (!data?.length) return fail(res, new Error('No devices subscribed yet'), 404);
    const r = await sendToAll(data, { title: 'Coast Watch test', body: 'Alerts are working on this device. You will hear about beach driving dates, coast rules, and razor clam digs.', url: '/#plan', tag: 'wff-test' });
    json(res, { ok: true, devices: data.length, ...r }, 0);
  } catch (e) { fail(res, e); }
}
