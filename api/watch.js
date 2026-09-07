import { json, fail, getText } from './_util.js';
import { collect } from './coast.js';
import { parseRss } from './rules.js';
import { pushReady, missingEnv, admin, sendToAll } from './_push.js';

/**
 * Daily watch job (Vercel cron, see vercel.json). Looks at the same feeds the Coast Watch card
 * shows, compares against what it saw last time, and pushes one notification per device when
 * something is new. Beach driving dates come from the WAC calendar, so those alerts fire on the
 * day and three days ahead.
 */
const RULES_RSS = 'https://wdfw.wa.gov/fishing/regulations/emergency-rules/rss';
const COAST_RULE_RE = /razor clam|copalis|mocrocks|ocean shores|grays harbor|marine area 2\b|marine area 2-|north beach|ocean city|moclips|pacific beach|surf ?perch|westport|coastal|domoic|point brown|damon point|north jetty|humptulips|quinault|hoquiam|wynoochee|satsop|chehalis river/i;

/** Today's date parts in Pacific time. */
function pacificToday(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const get = (t) => +p.find(x => x.type === t).value;
  return { y: get('year'), m: get('month'), d: get('day') };
}
function laborDay(y) { const first = new Date(Date.UTC(y, 8, 1)); const shift = (1 - first.getUTCDay() + 7) % 7; return 1 + shift; }
function dayNum(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

/** Driving alert for today, if today is a flip day or three days before one. */
function driveAlert(now = new Date()) {
  const { y, m, d } = pacificToday(now);
  const today = dayNum(y, m, d);
  const close = dayNum(y, 4, 15);
  const reopen = dayNum(y, 9, laborDay(y) + 2);
  if (today === close) return { title: 'Beach driving: seasonal closures start today', body: 'Ocean Shores jetty, Pacific Way to Chance a la Mer, north of Ocean City, Copalis Rock, Roosevelt Beach, and Moclips segments are closed to vehicles through the day after Labor Day.' };
  if (today === close - 3) return { title: 'Beach driving: seasonal closures in 3 days', body: 'Seasonal North Beach segments close to vehicles April 15.' };
  if (today === reopen) return { title: 'Beach driving: seasonal segments reopen today', body: 'Every North Beach segment is open to vehicles again except Benner Gap to the Copalis River. 25 mph, hard sand, no ATVs.' };
  if (today === reopen - 3) return { title: 'Beach driving: segments reopen in 3 days', body: 'Seasonal closures end the day after Labor Day. Vehicles are back on the full strip after that.' };
  return null;
}

/** Same id scheme as the app's Coast Watch card. */
function idsOf(coast, rules) {
  const items = [];
  if (coast.razor?.headline) items.push({ id: 'razor:' + coast.razor.headline + '|' + (coast.razor.posted || ''), title: coast.razor.headline, kind: 'Razor clams' });
  for (const n of coast.news || []) items.push({ id: 'news:' + n.id, title: n.title, kind: n.north ? 'WDFW, North Beach' : 'WDFW coast' });
  const a = coast.oceanShores?.alert;
  if (a) items.push({ id: 'alert:' + a.title + '|' + (a.date || ''), title: a.title, kind: 'Ocean Shores alert' });
  for (const n of coast.oceanShores?.news || []) if (n.beach) items.push({ id: 'os:' + n.link, title: n.title, kind: 'Ocean Shores' });
  for (const r of rules) items.push({ id: 'rule:' + r.id, title: r.title, kind: 'Emergency rule' });
  return items;
}

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers?.authorization || '';
    const dry = req.query?.dry === '1';
    if (secret && auth !== `Bearer ${secret}` && !dry) return fail(res, new Error('unauthorized'), 401);
    if (!pushReady()) return json(res, { ok: false, missing: missingEnv() }, 0);

    const [coast, rulesXml] = await Promise.all([collect(), getText(RULES_RSS).catch(() => '')]);
    const rules = parseRss(rulesXml).filter(r => COAST_RULE_RE.test(`${r.title} ${r.location} ${r.species}`) || r.counties.includes('Grays Harbor'));
    const items = idsOf(coast, rules);
    const db = admin();
    const { data: prev } = await db.from('watch_state').select('*').eq('key', 'coast').maybeSingle();
    const seen = new Set(prev?.payload?.ids || []);
    const fresh = prev ? items.filter(i => !seen.has(i.id)) : [];
    const drive = driveAlert();

    const notes = [];
    if (fresh.length) {
      const top = fresh.slice(0, 3).map(i => `${i.kind}: ${i.title}`).join('\n');
      notes.push({ title: fresh.length === 1 ? 'Coast Watch: 1 update' : `Coast Watch: ${fresh.length} updates`, body: top, url: '/#plan', tag: 'wff-coast' });
    }
    if (drive) notes.push({ ...drive, url: '/#plan', tag: 'wff-drive' });

    let sent = [];
    if (!dry && notes.length) {
      const { data: subs, error } = await db.from('push_subscriptions').select('*').contains('topics', ['coast']);
      if (error) throw error;
      for (const n of notes) sent.push(await sendToAll(subs || [], n));
    }
    if (!dry) {
      const merged = Array.from(new Set([...(prev?.payload?.ids || []), ...items.map(i => i.id)])).slice(-600);
      await db.from('watch_state').upsert({ key: 'coast', hash: String(items.length), payload: { ids: merged, at: new Date().toISOString() }, updated_at: new Date().toISOString() });
    }
    json(res, { ok: true, dry, firstRun: !prev, items: items.length, fresh: fresh.map(i => i.id), notes, sent }, 0);
  } catch (e) { fail(res, e); }
}
