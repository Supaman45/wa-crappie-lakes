import { json, fail } from './_util.js';

const UA = 'WA-Fish-Finder/3.4 (https://wa-crappie-lakes.vercel.app; strong.serimon@gmail.com)';

/** Resolve a US ZIP or a place name inside Washington to a point. Runs server side so the geocoders see a proper User-Agent. */
export default async function handler(req, res) {
  try {
    const q = String(req.query?.q || '').trim();
    if (!q) return fail(res, new Error('q required'), 400);
    if (/^\d{5}$/.test(q)) {
      const r = await fetch(`https://api.zippopotam.us/us/${q}`, { headers: { 'User-Agent': UA } });
      if (!r.ok) return fail(res, new Error('ZIP not found'), 404);
      const j = await r.json();
      const p = j.places?.[0];
      if (!p) return fail(res, new Error('ZIP not found'), 404);
      return json(res, { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), label: `${p['place name']}, ${p['state abbreviation']} ${q}` }, 7 * 24 * 3600);
    }
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=-124.9,49.1,-116.8,45.5&bounded=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en' } });
    if (!r.ok) return fail(res, new Error('geocoder ' + r.status), 502);
    const j = await r.json();
    const hit = j?.[0];
    if (!hit) return fail(res, new Error(`No place called "${q}" in Washington`), 404);
    json(res, { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: (hit.name || hit.display_name || q).split(',')[0] }, 7 * 24 * 3600);
  } catch (e) { fail(res, e); }
}
