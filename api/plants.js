import { json, fail, getText, decode } from './_util.js';

const BASE = 'https://wdfw.wa.gov/fishing/reports/stocking/trout-plants';

function cell(s) { return decode(s); }

export function parsePlants(html) {
  const rows = [];
  const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const body = tbody ? tbody[1] : html;
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(body))) {
    const cells = Array.from(m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(x => cell(x[1]));
    if (cells.length < 6) continue;
    const [lakeRaw, dateRaw, species, numberRaw, fplRaw, hatchery, notes] = cells;
    if (!/\d{4}/.test(dateRaw)) continue;
    // "MAYFIELD RES (LEWI), Lewis - Region 5"
    const lm = lakeRaw.match(/^(.*?)\s*(?:\(([A-Z]{2,5})\))?\s*,?\s*([A-Za-z .']+?)\s*-\s*Region\s*(\d+)\s*$/);
    const lake = lm ? lm[1].trim() : lakeRaw;
    const county = lm ? lm[3].trim() : '';
    const region = lm ? Number(lm[4]) : null;
    const d = new Date(dateRaw);
    rows.push({ lake, lake_raw: lakeRaw, county, region, date: isNaN(d.getTime()) ? dateRaw : d.toISOString().slice(0, 10), species, number: Number(String(numberRaw).replace(/[^\d]/g, '')) || 0, fish_per_lb: parseFloat(fplRaw) || null, hatchery: hatchery || '', notes: notes || '' });
  }
  return rows;
}

export default async function handler(req, res) {
  try {
    const q = new URLSearchParams();
    if (req.query?.county) q.set('county', String(req.query.county));
    if (req.query?.lake) q.set('lake_stocked', String(req.query.lake));
    if (req.query?.region) q.set('region', String(req.query.region));
    q.set('order', 'stock_date'); q.set('sort', 'desc');
    const html = await getText(`${BASE}?${q}`);
    let rows = parsePlants(html);
    const county = req.query?.county ? String(req.query.county).toLowerCase() : '';
    if (county) rows = rows.filter(r => r.county.toLowerCase() === county);
    json(res, { fetched: new Date().toISOString(), count: rows.length, rows }, 3600);
  } catch (e) { fail(res, e); }
}
