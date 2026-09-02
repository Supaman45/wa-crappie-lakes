import { json, fail, getText, decode } from './_util.js';

const RSS = 'https://wdfw.wa.gov/fishing/regulations/emergency-rules/rss';

function field(desc, label) {
  // description is HTML; fields look like <p><strong>Action:</strong> text</p>
  const re = new RegExp(`<strong>\\s*${label}[^<]*<\\/strong>\\s*:?\\s*([\\s\\S]*?)<\\/p>`, 'i');
  const m = desc.match(re);
  return m ? decode(m[1]).replace(/^:\s*/, '') : '';
}

function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}

const COUNTY_RE = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)?) County\b/g;

export function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    const get = (tag) => { const x = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return x ? x[1].trim() : ''; };
    let desc = get('description');
    if (desc.startsWith('<![CDATA[')) desc = desc.slice(9, -3); else desc = unescapeXml(desc);
    const title = decode(get('title'));
    const link = get('link').trim();
    const pub = get('pubDate');
    const action = field(desc, 'Action');
    const effective = field(desc, 'Effective date') || field(desc, 'Effective dates');
    const species = field(desc, 'Species affected');
    const location = field(desc, 'Location') || field(desc, 'Locations');
    const rules = field(desc, 'Rules');
    const reason = field(desc, 'Reason for action') || field(desc, 'Reason for actions');
    const counties = Array.from(new Set(Array.from((location + ' ' + title).matchAll(COUNTY_RE)).map(x => x[1])));
    const text = decode(desc);
    const head = (action || title).trim();
    const kind = /^(opens?|reopens?|extends?|allows?|increases?)\b/i.test(head) ? 'open' : /^(closes?|closures?|closed|prohibits?|suspends?)\b/i.test(head) || /\bclosed?\b/i.test(title) ? 'close' : 'change';
    const water = /marine area/i.test(title) ? 'salt' : /(lake|reservoir|pond)\b/i.test(title + ' ' + location) ? 'lake' : /(river|creek|stream|fork)\b/i.test(title + ' ' + location) ? 'river' : 'other';
    items.push({ id: get('guid').replace(/<[^>]+>/g, '').trim() || link, title, link, published: pub ? new Date(pub).toISOString() : null, kind, water, action, effective, species, location, rules, reason, counties, text: text.slice(0, 1200) });
  }
  return items;
}

export default async function handler(req, res) {
  try {
    const xml = await getText(RSS);
    const items = parseRss(xml);
    json(res, { fetched: new Date().toISOString(), count: items.length, items }, 1800);
  } catch (e) { fail(res, e); }
}
