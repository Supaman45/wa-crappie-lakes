export interface GeoHit { lat: number; lng: number; label: string; }

async function viaServer(q: string): Promise<GeoHit> {
  const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  const j = await r.json().catch(() => ({})) as Partial<GeoHit> & { error?: string };
  if (!r.ok || typeof j.lat !== 'number') throw new Error(j.error || `lookup failed (${r.status})`);
  return { lat: j.lat, lng: j.lng as number, label: j.label || q };
}

/** ZIP lookup: our own function first (stable from phones and the installed app), Zippopotam direct as a fallback. */
export async function resolveZip(zip: string): Promise<GeoHit> {
  try { return await viaServer(zip); } catch (e) { if (/not found/i.test((e as Error).message)) throw e; }
  const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!r.ok) throw new Error('ZIP not found');
  const j = await r.json();
  const p = j.places?.[0];
  if (!p) throw new Error('ZIP not found');
  return { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), label: `${p['place name']}, ${p['state abbreviation']} ${zip}` };
}

/** Place lookup inside Washington: our own function first, Nominatim direct as a fallback. */
export async function geocodePlace(q: string): Promise<GeoHit> {
  try { return await viaServer(q); } catch (e) { if (/No place called/i.test((e as Error).message)) throw e; }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q + ' Washington')}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Place lookup failed. Check your signal and try again.');
  const j = await r.json();
  const hit = j?.[0];
  if (!hit) throw new Error(`No place called "${q}" in Washington`);
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: (hit.name || hit.display_name || q).split(',')[0] };
}

export function locateMe(): Promise<GeoHit> {
  return new Promise((res, rej) => {
    if (!('geolocation' in navigator)) { rej(new Error('No GPS on this device')); return; }
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }),
      e => rej(new Error(e.code === 1 ? 'Location permission denied. Allow location for this site in your browser settings.' : 'Could not get location')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
