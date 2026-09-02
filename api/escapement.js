import { json, fail, getText, UA } from './_util.js';

const PAGE = 'https://wdfw.wa.gov/fishing/management/hatcheries/escapement';
const PDF_RE = /(?:https?:\/\/wdfw\.wa\.gov)?\/sites\/default\/files\/[^"' )]*weekly-escapement-(\d{2})-(\d{2})-(\d{4})\.pdf/g;

/** Positioned text items per page: [{s, x, y}] (PDF user space, origin bottom-left). */
async function pdfItems(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) })));
  }
  return pages;
}

const NUM = /^-?[\d,]+$/;
function num(s) { if (s == null || s === '-' || s === '--' || s === '') return null; const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; }

const BAND_KEYS = [
  [/adult\s*total/i, 'adult_total'], [/jack\s*total/i, 'jack_total'], [/total\s*eggtake|eggtake\s*total/i, 'eggtake'],
  [/on hand\s*adults/i, 'on_hand_adults'], [/on hand\s*jacks/i, 'on_hand_jacks'], [/lethal\s*spawned/i, 'lethal_spawned'],
  [/live\s*spawned/i, 'live_spawned'], [/released/i, 'released'], [/live\s*shipped/i, 'live_shipped'], [/mortality/i, 'mortality'],
  [/surplus/i, 'surplus'], [/^date/i, 'date'], [/comments/i, 'comments'], [/stock/i, 'stock'],
];
function bandKey(name) { for (const [re, k] of BAND_KEYS) if (re.test(name)) return k; return name.toLowerCase().replace(/\W+/g, '_'); }

/**
 * The weekly report is a landscape table rendered rotated: each facility is a column at a fixed x,
 * row labels sit just left of the "Facility" anchor, and values for a row sit at y >= the label's y.
 * A page can hold several species sections side by side along x; each starts with its own
 * "Facility" anchor (species name ~23 px to its left). The report date sits in the header at y < 45.
 */
export function structureRotated(pages) {
  const out = { reportDate: null, species: [] };
  const DATE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  for (const items of pages) {
    const header = items.filter(i => i.y < 45);
    const dateItem = header.find(i => /\b\d{4}$/.test(i.s) && /,/.test(i.s));
    if (dateItem && !out.reportDate) { const d = new Date(dateItem.s.replace(/^[A-Za-z]+,\s*/, '')); if (!isNaN(d)) out.reportDate = d.toISOString().slice(0, 10); }
    const anchors = header.filter(i => i.s === 'Facility').sort((a, b) => a.x - b.x);
    for (let a = 0; a < anchors.length; a++) {
      const fx = anchors[a].x;
      const endX = a + 1 < anchors.length ? anchors[a + 1].x - 26 : (dateItem ? dateItem.x - 2 : 545);
      const speciesItem = header.find(i => i.x >= fx - 30 && i.x < fx - 8);
      const species = speciesItem ? speciesItem.s : 'Unknown';
      const colItems = header.filter(i => i.x > fx + 5 && i.x < endX && !/^Page \d/.test(i.s)).sort((a, b) => a.x - b.x);
      // merge wrapped facility names (continuation at x+8..12)
      const cols = [];
      for (const it of colItems) {
        const last = cols[cols.length - 1];
        if (last && it.x - last.x <= 13) { last.name += ' ' + it.s; continue; }
        cols.push({ x: it.x, name: it.s });
      }
      const labels = items.filter(i => i.x >= fx - 20 && i.x <= fx + 5 && i.y > 60).sort((a, b) => a.y - b.y);
      // Two-line labels ("Adult" / "Total", "On Hand" / "Adults") render as two items ~11 px apart in x
      // and within a few px in y. Group by y proximity, then read the parts left to right.
      const bands = [];
      for (const l of labels) {
        const last = bands[bands.length - 1];
        if (last && l.y - last.y <= 10 && Math.abs(l.x - last.x) <= 15) { last.parts.push(l); last.y = Math.min(last.y, l.y); continue; }
        bands.push({ y: l.y, x: l.x, parts: [l] });
      }
      for (const b of bands) { b.name = b.parts.sort((a, c) => a.x - c.x || a.y - c.y).map(p => p.s).join(' '); b.key = bandKey(b.name); }
      const bandFor = (y) => { let best = null; for (const b of bands) if (b.y <= y + 3) best = b; return best; };
      const dateBand = bands.find(b => b.key === 'date');
      const sec = { species, rows: [] };
      for (const c of cols) {
        const row = { facility: c.name, stock: '', comments: '', date: null };
        const mine = items.filter(i => i.y > 60 && i.x < endX && (Math.abs(i.x - c.x) <= 4 || (i.x - c.x > 4 && i.x - c.x <= 13 && !NUM.test(i.s)))).sort((a, b) => a.y - b.y || a.x - b.x);
        for (const it of mine) {
          const b = bandFor(it.y); if (!b) continue;
          // comment text sits between the Date row and the Comments label (and wraps to x+11)
          const isComment = b.key === 'comments' || (dateBand && it.y > dateBand.y + 3 && !DATE.test(it.s) && !NUM.test(it.s));
          if (b.key === 'stock') row.stock = (row.stock + ' ' + it.s).trim();
          else if (isComment) row.comments = (row.comments + ' ' + it.s).trim();
          else if (b.key === 'date') { if (DATE.test(it.s)) row.date = it.s; }
          else if (NUM.test(it.s) || it.s === '-' || it.s === '--') { if (row[b.key] == null) row[b.key] = num(it.s); }
        }
        // pdf.js sometimes joins the facility (upper case) and stock (mixed case) into one text run
        const fm = row.facility.match(/^([A-Z0-9][A-Z0-9 .\/&'()-]*[A-Z0-9])\s+([A-Z][a-z].*)$/);
        if (fm) { row.facility = fm[1]; row.stock = (fm[2] + ' ' + row.stock).trim(); }
        // stock like "Skokomish River- H" -> origin flag (H hatchery, W wild, M mixed)
        const m = row.stock.match(/-\s*([HWMU])\b\s*$/); row.origin = m ? ({ H: 'hatchery', W: 'wild', M: 'mixed', U: 'unknown' })[m[1]] : null;
        sec.rows.push(row);
      }
      if (sec.rows.length) out.species.push(sec);
    }
  }
  // merge sections of the same species (a species can span pages)
  const merged = new Map();
  for (const s of out.species) { const m = merged.get(s.species); if (m) m.rows.push(...s.rows); else merged.set(s.species, { species: s.species, rows: [...s.rows] }); }
  out.species = Array.from(merged.values());
  return out;
}

async function latestPdfUrls(n = 2) {
  const html = await getText(PAGE);
  const found = new Map();
  for (const m of html.matchAll(PDF_RE)) { const abs = m[0].startsWith('http') ? m[0] : 'https://wdfw.wa.gov' + m[0]; found.set(abs, `${m[3]}-${m[1]}-${m[2]}`); }
  return Array.from(found.entries()).sort((a, b) => b[1].localeCompare(a[1])).slice(0, n).map(([url, date]) => ({ url, date }));
}

export default async function handler(req, res) {
  try {
    const debug = req.query?.debug;
    const urls = await latestPdfUrls(debug ? 1 : 2);
    if (!urls.length) throw new Error('no weekly escapement PDF found on the WDFW page');
    const bufs = await Promise.all(urls.map(async u => { const r = await fetch(u.url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${u.url} -> ${r.status}`); return r.arrayBuffer(); }));
    const pages = await Promise.all(bufs.map(pdfItems));
    if (debug) {
      const pg = Number(debug) || 1;
      return json(res, { url: urls[0].url, pages: pages[0].length, page: pg, items: (pages[0][pg - 1] || []).map(i => `${i.x},${i.y}:${i.s}`) }, 0);
    }
    const latest = structureRotated(pages[0]); latest.url = urls[0].url; latest.fileDate = urls[0].date;
    const prev = pages[1] ? structureRotated(pages[1]) : null;
    if (prev) {
      const key = (sp, r) => `${sp}|${r.facility}|${r.stock}`;
      const pm = new Map(); for (const s of prev.species) for (const r of s.rows) pm.set(key(s.species, r), r);
      for (const s of latest.species) for (const r of s.rows) { const p = pm.get(key(s.species, r)); r.prev_adult_total = p?.adult_total ?? null; r.delta = (r.adult_total != null && p?.adult_total != null) ? r.adult_total - p.adult_total : null; }
    }
    json(res, { fetched: new Date().toISOString(), latest, previous: prev ? { fileDate: urls[1].date, reportDate: prev.reportDate, url: urls[1].url } : null }, 6 * 3600);
  } catch (e) { fail(res, e); }
}
