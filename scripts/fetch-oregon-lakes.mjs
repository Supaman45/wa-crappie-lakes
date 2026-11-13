#!/usr/bin/env node
// Builds src/data/lakes-or.json: Oregon lakes and the fish ODFW maps in them.
//
// Runs in GitHub Actions (.github/workflows/oregon-lakes.yml), because the build sandbox cannot
// reach state GIS hosts. Node 20, no dependencies.
//
// Sources
// - ODFW Fish Habitat Distribution, one polygon layer per species "(lake)":
//   https://nrimp.dfw.state.or.us/arcgis/rest/services/FHD/OregonFishHabitatDistribution2/FeatureServer
// - County names: US Census TIGERweb county polygons (point in polygon).
// - Elevation: Open-Meteo elevation API (Copernicus 90 m DEM), 100 points per request.
//
// Output rows match lakes.json, plus st:"OR" and o (the ODFW feature id). k is a guess for Oregon:
// small lakes above 5,000 ft are tagged hike-in, since FHD has no access field.

import { writeFile, readFile } from 'node:fs/promises';

const FHD = 'https://nrimp.dfw.state.or.us/arcgis/rest/services/FHD/OregonFishHabitatDistribution2/FeatureServer';
const OUT = new URL('../src/data/lakes-or.json', import.meta.url);

// FHD layer id -> app species id. Layer ids come from FeatureServer/layers (checked Nov 2026).
const LAYERS = {
  99: 'crappie', 101: 'crappie',
  89: 'largemouth', 91: 'smallmouth',
  18: 'rainbow', 16: 'rainbow',      // redband is a native rainbow
  28: 'brown', 26: 'brook', 29: 'laker',
  20: 'cutthroat', 10: 'kokanee',    // sockeye in a lake is kokanee to an angler
  93: 'bluegill', 95: 'pumpkinseed',
  106: 'bullhead', 108: 'bullhead', 110: 'bullhead',
  117: 'perch', 119: 'walleye',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'pnw-fish-camp data build (github actions)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) {
      if (i >= tries) throw new Error(`${url.slice(0, 160)}: ${e.message}`);
      await sleep(1500 * i);
    }
  }
}

/** Every feature of one FHD layer: name, species, centroid, area. */
async function layerRows(id) {
  const out = [];
  for (let offset = 0; ; offset += 2000) {
    const q = new URLSearchParams({
      where: '1=1',
      outFields: 'fhdFtrID,fhdStNm,fhdSpNm,fhdOrig,Shape__Area',
      returnGeometry: 'false', returnCentroid: 'true', outSR: '4326',
      resultOffset: String(offset), resultRecordCount: '2000', f: 'json',
    });
    const j = await getJson(`${FHD}/${id}/query?${q}`);
    for (const f of j.features || []) {
      const a = f.attributes || {};
      const c = f.centroid;
      if (!c || c.x == null) continue;
      out.push({ fid: a.fhdFtrID, name: (a.fhdStNm || '').trim(), sp: a.fhdSpNm, orig: a.fhdOrig, m2: a.Shape__Area || 0, lat: c.y, lng: c.x });
    }
    if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
  }
  return out;
}

const SMALL = new Set(['of', 'the', 'and', 'at', 'on', 'in']);
function tidy(name) {
  let n = name.replace(/\s+/g, ' ').trim();
  if (n === n.toUpperCase()) {
    n = n.toLowerCase().replace(/\b[a-z]/g, (ch, i) => ch.toUpperCase());
    n = n.split(' ').map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ');
  }
  return n.replace(/\bRes\b\.?/g, 'Reservoir');
}
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

function km(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Oregon county polygons from TIGERweb, generalized. Returns [] if the service is down. */
async function counties() {
  try {
    const base = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer';
    const meta = await getJson(`${base}?f=json`);
    const layer = (meta.layers || []).find(l => /^counties$/i.test(l.name));
    if (!layer) throw new Error('no Counties layer');
    const q = new URLSearchParams({ where: "STATE='41'", outFields: 'NAME,BASENAME', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.002', f: 'json' });
    const j = await getJson(`${base}/${layer.id}/query?${q}`);
    return (j.features || []).map(f => ({ name: (f.attributes.BASENAME || f.attributes.NAME || '').replace(/ County$/, ''), rings: f.geometry?.rings || [] }));
  } catch (e) {
    console.warn('counties skipped:', e.message);
    return [];
  }
}
function inRings(lng, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Elevation in feet for each point, 100 per request. Missing values stay null. */
async function elevations(pts) {
  const out = new Array(pts.length).fill(null);
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    const q = `latitude=${chunk.map(p => p.lat.toFixed(5)).join(',')}&longitude=${chunk.map(p => p.lng.toFixed(5)).join(',')}`;
    try {
      const j = await getJson(`https://api.open-meteo.com/v1/elevation?${q}`);
      (j.elevation || []).forEach((m, k) => { if (typeof m === 'number' && m > -100) out[i + k] = Math.round(m * 3.28084); });
    } catch (e) { console.warn('elevation chunk failed:', e.message); }
    await sleep(250);
  }
  return out;
}

async function main() {
  const rows = [];
  for (const [id, sp] of Object.entries(LAYERS)) {
    const r = await layerRows(id);
    console.log(`layer ${id} ${sp}: ${r.length} polygons`);
    for (const x of r) rows.push({ ...x, app: sp });
    await sleep(300);
  }

  // One lake per water body. FHD repeats the water body in every species layer, sometimes split
  // into pieces, so group by name and merge pieces whose centers sit within 6 km.
  const groups = [];
  const byName = new Map();
  for (const r of rows) {
    if (!r.name || /^unnamed/i.test(r.name)) continue;
    const key = r.name.toLowerCase();
    const list = byName.get(key) || [];
    let g = list.find(g => km(g, r) < 6);
    if (!g) { g = { name: r.name, lat: r.lat, lng: r.lng, best: 0, sp: new Set(), fids: new Set() }; list.push(g); groups.push(g); byName.set(key, list); }
    // Area: Web Mercator m², scaled by cos² of latitude to true m².
    const m2 = r.m2 * Math.cos(r.lat * Math.PI / 180) ** 2;
    if (m2 > g.best) { g.best = m2; g.lat = r.lat; g.lng = r.lng; }
    g.sp.add(r.app);
    if (r.fid != null) g.fids.add(r.fid);
  }
  console.log(`${rows.length} polygons -> ${groups.length} lakes`);

  const cty = await counties();
  const elev = await elevations(groups);

  const ORDER = ['crappie', 'largemouth', 'smallmouth', 'walleye', 'perch', 'bluegill', 'pumpkinseed', 'bullhead', 'rainbow', 'cutthroat', 'brown', 'brook', 'laker', 'kokanee'];
  const used = new Set();
  // Keep WA slugs out of the way: catches store lake_id by slug.
  try { for (const l of JSON.parse(await readFile(new URL('../src/data/lakes.json', import.meta.url), 'utf8'))) used.add(l.s); } catch { /* fine */ }

  const out = groups.map((g, i) => {
    const name = tidy(g.name);
    const county = cty.find(c => inRings(g.lng, g.lat, c.rings))?.name;
    const acres = g.best ? Math.round((g.best / 4046.86) * 10) / 10 : null;
    const e = elev[i] ?? 0;
    let s = `${slugify(name)}-or`;
    if (used.has(s)) s = `${slugify(name)}-${slugify(county || 'or')}-or`;
    for (let n = 2; used.has(s); n++) s = `${slugify(name)}-or-${n}`;
    used.add(s);
    const high = e >= 5000 && acres != null && acres < 30;
    return {
      n: name, s, a: acres, e, c: county ? [county] : [],
      y: Math.round(g.lat * 1e5) / 1e5, x: Math.round(g.lng * 1e5) / 1e5,
      p: ORDER.filter(sp => g.sp.has(sp)), k: high ? 'H' : 'L', m: '', w: 0,
      st: 'OR', o: [...g.fids][0] ?? 0,
    };
  }).filter(l => l.y > 41.9 && l.y < 46.3 && l.x > -124.7 && l.x < -116.4)
    .sort((a, b) => a.n.localeCompare(b.n));

  if (out.length < 200) throw new Error(`only ${out.length} Oregon lakes, refusing to overwrite`);
  await writeFile(OUT, JSON.stringify(out) + '\n');
  const sp = {};
  for (const l of out) for (const p of l.p) sp[p] = (sp[p] || 0) + 1;
  console.log(`wrote ${out.length} lakes`, JSON.stringify(sp), `no county: ${out.filter(l => !l.c.length).length}`, `no elev: ${out.filter(l => !l.e).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
