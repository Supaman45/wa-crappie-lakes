import { json, fail, getText, decode } from './_util.js';

/**
 * River Watch feed. The Puyallup Tribe posts each net opening as a filing PDF on its Fisheries
 * Harvest and Regulations page. The app ships the current windows as curated data (see
 * src/domain/river.ts) because the dates live inside the PDFs; this endpoint watches the page so
 * the card can say "a filing you have not seen went up" and link straight to it.
 *
 * Debug: /api/river?debug=raw returns the anchors as parsed.
 */
const PUY_FILINGS = 'https://www.puyalluptribe-nsn.gov/member-services/tribal-natural-resources/fisheries/harvest-regulations/';

/**
 * The page is one <dl class="accordion">: a <dt> carrying the filing's title, then a <dd> with
 * the PDF link and a "Posted on:" line. Every anchor reads "View and Download PDF", so the title
 * has to come from the <dt> rather than the link text.
 */
const ITEM_RE = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
const HREF_RE = /href=["']([^"']*wp-content\/uploads\/[^"']+\.pdf)["']/i;
const DATE_RE = /Posted\s*on:?\s*([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
const ANY_DATE_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i;

/** Marine and shellfish openings are filed on the same page. Keep the river ones. */
const MARINE_RE = /\b(marine|area 11|area 13|carr inlet|minter|fox island|chamber|bottom ?fish|smelt|east ?west|shellfish|crab|clam|net pens)\b/i;
const RIVER_RE = /\b(puyallup river|white river|carbon|river|coho|chinook|chum|steelhead|elders|freshwater|hook and line)\b/i;

export function fileOf(url) {
  try { return decodeURIComponent(String(url).split('/').pop() || ''); } catch { return String(url).split('/').pop() || ''; }
}

export function filings(html) {
  const out = [];
  const seen = new Set();
  let m;
  ITEM_RE.lastIndex = 0;
  while ((m = ITEM_RE.exec(html))) {
    const title = decode(m[1].replace(/<span\b[^>]*accordion__toggle[\s\S]*?<\/span>/gi, ''));
    const href = m[2].match(HREF_RE);
    if (!title || !href) continue;
    // The site links its own uploads over http; serve the app an https URL.
    const url = (href[1].startsWith('http') ? href[1] : `https://www.puyalluptribe-nsn.gov${href[1].startsWith('/') ? '' : '/'}${href[1]}`).replace(/^http:\/\//, 'https://');
    const file = fileOf(url);
    if (seen.has(file)) continue;
    seen.add(file);
    const d = m[2].match(DATE_RE) || m[2].match(ANY_DATE_RE);
    const marine = MARINE_RE.test(title) && !/puyallup river|white river/i.test(title);
    out.push({
      file,
      url,
      title,
      posted: d ? new Date(`${d[1]} ${d[2]}, ${d[3]} 12:00:00Z`).toISOString().slice(0, 10) : null,
      river: !marine && RIVER_RE.test(title),
      species: /coho/i.test(title) ? 'coho' : /chinook/i.test(title) ? 'chinook' : /chum/i.test(title) ? 'chum' : /steelhead/i.test(title) ? 'steelhead' : null,
    });
  }
  return out;
}

export async function collectRiver() {
  const html = await getText(PUY_FILINGS);
  const all = filings(html);
  return {
    fetched: new Date().toISOString(),
    source: PUY_FILINGS,
    count: all.length,
    // Keep the page's own order (newest first) and cap the payload.
    filings: all.slice(0, 40),
  };
}

export default async function handler(req, res) {
  try {
    if (req.query?.debug === 'raw') {
      const html = await getText(PUY_FILINGS);
      return json(res, { bytes: html.length, filings: filings(html) }, 0);
    }
    json(res, await collectRiver(), 3600);
  } catch (e) {
    // A card that says "could not reach the tribe's page" still beats a card that shows nothing,
    // so answer 200 with the error attached and let the client fall back to curated data.
    json(res, { fetched: new Date().toISOString(), source: PUY_FILINGS, count: 0, filings: [], error: String(e?.message || e) }, 300);
  }
}
