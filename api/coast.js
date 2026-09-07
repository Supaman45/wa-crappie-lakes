import { json, fail, getText, decode } from './_util.js';

/**
 * Coast Watch: what changed on the North Beach coast (Ocean Shores, Copalis, Mocrocks).
 *  - WDFW razor clam page: latest release, approved dig dates for Copalis and Mocrocks, season notes
 *  - WDFW newsroom RSS filtered to coast items
 *  - City of Ocean Shores: top alert plus recent news
 * Emergency fishing rules come from /api/rules and are filtered on the client.
 * Beach driving dates (WAC 352-37-060) are computed on the client so they work offline.
 */
const RAZOR = 'https://wdfw.wa.gov/fishing/shellfishing-regulations/razor-clams';
const NEWS_RSS = 'https://wdfw.wa.gov/newsroom/rss';
const OS_NEWS = 'https://www.osgov.com/newslist.php';
const OS_ALERT = 'https://www.osgov.com/top_alert_detail.php';

export const COAST_RE = /razor clam|copalis|mocrocks|ocean shores|grays harbor|marine area 2\b|surf ?perch|north beach|ocean city|moclips|pacific beach|coastal (?:razor|salmon|halibut|beach|fishing|crab|waters|steelhead)|domoic|damon point|north jetty|coastal halibut|ocean salmon|westport/i;
/** North Beach specifically: the stretch he fishes. */
export const NORTH_RE = /razor clam|copalis|mocrocks|ocean shores|grays harbor|marine area 2\b|north beach|ocean city|moclips|pacific beach|damon point|north jetty|domoic/i;
const BEACH_RE = /beach|vehicle|closure|closed|drive|driving|access|jetty|damon|approach|tide|storm|surf/i;
const DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:\s*,\s*\d{4})?/i;
const FULL_DATE_RE = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b/i;

/** Readable blocks (headings, paragraphs, list items) out of a page's main content, in order. */
export function blocks(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
  const out = [];
  const re = /<(h[1-4]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(main))) {
    const text = decode(m[2]);
    if (text) out.push({ tag: m[1].toLowerCase(), text });
  }
  return out;
}

/** Latest razor clam release: headline, date, dig list, and the notes that matter for North Beach. */
export function razorClams(html) {
  const b = blocks(html);
  const h1 = b.findIndex(x => x.tag === 'h1');
  const h2 = b.findIndex((x, i) => i > h1 && x.tag === 'h2');
  const headline = h2 >= 0 ? b[h2].text : null;
  let posted = null;
  const digs = [];
  const notes = [];
  let window = null;
  const end = b.findIndex((x, i) => i > h2 && x.tag === 'h2');
  const body = h2 >= 0 ? b.slice(h2 + 1, end > 0 ? end : undefined) : b;
  for (const x of body) {
    const t = x.text;
    if (!posted && FULL_DATE_RE.test(t) && t.length < 40) { posted = t.match(FULL_DATE_RE)[0]; continue; }
    if (/^contact:/i.test(t) || /media contact/i.test(t)) continue;
    if (x.tag === 'li' && DATE_RE.test(t) && /feet|ft\b|tide|a\.m\.|p\.m\./i.test(t)) {
      digs.push({ text: t, copalis: /copalis/i.test(t), mocrocks: /mocrocks/i.test(t) });
      continue;
    }
    if (!window && /following digs|will proceed|during (morning|evening|afternoon)/i.test(t)) { window = t; continue; }
    if (t.length < 420 && /copalis|mocrocks|kalaloch|north beach|tentative|domoic|not open every day|closed|daily limit|plover/i.test(t)) notes.push(t);
  }
  const north = digs.filter(d => d.copalis || d.mocrocks);
  return { url: RAZOR, headline, posted, window, digs: north.slice(0, 40), allDigs: digs.length, notes: notes.slice(0, 8) };
}

function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}

/** WDFW newsroom RSS, coast items only. */
export function newsroom(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    const get = (tag) => { const x = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return x ? x[1].trim() : ''; };
    let desc = get('description');
    desc = desc.startsWith('<![CDATA[') ? desc.slice(9, -3) : unescapeXml(desc);
    const title = decode(get('title'));
    const text = decode(desc);
    const hay = title + ' ' + text;
    if (!COAST_RE.test(hay)) continue;
    const pub = get('pubDate');
    out.push({ id: get('guid').replace(/<[^>]+>/g, '').trim() || get('link'), title, link: get('link'), published: pub ? new Date(pub).toISOString() : null, summary: text.slice(0, 300), north: NORTH_RE.test(hay), razor: /razor clam/i.test(hay) });
  }
  return out.slice(0, 20);
}

/** City of Ocean Shores news list. The page renders from an inline JSON dataSource; fall back to links. */
export function oceanShoresNews(html) {
  const out = [];
  const m0 = html.match(/dataSource:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (m0) {
    try {
      const arr = JSON.parse(m0[1]);
      for (const it of arr) {
        if (!it || !it.link || !it.title) continue;
        const link = String(it.link).startsWith('http') ? it.link : 'https://www.osgov.com/' + String(it.link).replace(/^\//, '');
        if (!out.some(o => o.link === link)) out.push({ title: decode(it.title), link, date: it.date || null, beach: BEACH_RE.test(it.title) });
        if (out.length >= 20) break;
      }
    } catch { /* fall through */ }
  }
  let m;
  if (!out.length) {
    // fallback: any news_detail link with a date nearby
    const re2 = /<a[^>]+href="([^"]*news_detail[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = re2.exec(html))) {
      const title = decode(m[2]);
      if (!title || /^read more$/i.test(title)) continue;
      const link = m[1].startsWith('http') ? m[1] : 'https://www.osgov.com/' + m[1].replace(/^\//, '');
      const around = html.slice(Math.max(0, m.index - 300), m.index);
      const date = (around.match(/\b\w{3} \d{1,2}, \d{4}\b/g) || []).pop() || null;
      if (!out.some(o => o.link === link)) out.push({ title, link, date, beach: BEACH_RE.test(title) });
    }
  }
  return out.slice(0, 20);
}

/** City of Ocean Shores top alert banner (the red bar on the home page). */
export function oceanShoresAlert(html) {
  const post = (html.match(/<div id="post"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) || [html])[0];
  const title = decode((post.match(/<span class="subheader">([\s\S]*?)<\/span>/i) || [])[1] || '');
  if (!title) return null;
  const paras = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(post))) { const t = decode(m[1]); if (t) paras.push(t); }
  const body = paras.filter(t => !/copy and paste this code|share this page/i.test(t)).join(' ');
  const date = (body.match(FULL_DATE_RE) || [null])[0];
  return { title, date, text: body.slice(0, 700), link: OS_ALERT, beach: BEACH_RE.test(title + ' ' + body) };
}

/** Everything Coast Watch shows, in one object. Shared with the daily watch job. */
export async function collect() {
  const [razor, news, os, alert] = await Promise.all([
    getText(RAZOR).then(razorClams).catch(e => ({ url: RAZOR, error: String(e.message || e), headline: null, posted: null, window: null, digs: [], allDigs: 0, notes: [] })),
    getText(NEWS_RSS).then(newsroom).catch(() => []),
    getText(OS_NEWS).then(oceanShoresNews).catch(() => []),
    getText(OS_ALERT).then(oceanShoresAlert).catch(() => null),
  ]);
  return { fetched: new Date().toISOString(), razor, news, oceanShores: { alert, news: os } };
}

export default async function handler(req, res) {
  try {
    const debug = req.query?.debug;
    if (debug === 'razor') { const html = await getText(RAZOR); return json(res, { blocks: blocks(html).slice(0, 120), parsed: razorClams(html) }, 0); }
    if (debug === 'os') { const html = await getText(OS_NEWS); return json(res, { len: html.length, parsed: oceanShoresNews(html), sample: html.slice(0, 2000) }, 0); }
    if (debug === 'alert') { const html = await getText(OS_ALERT); return json(res, { len: html.length, parsed: oceanShoresAlert(html) }, 0); }
    if (debug === 'news') { const xml = await getText(NEWS_RSS); return json(res, { len: xml.length, parsed: newsroom(xml) }, 0); }
    json(res, await collect(), 1800);
  } catch (e) { fail(res, e); }
}
