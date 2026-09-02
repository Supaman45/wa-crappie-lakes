export interface GeoHit { lat: number; lng: number; label: string; }

export async function resolveZip(zip: string): Promise<GeoHit> {
  const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!r.ok) throw new Error('ZIP not found');
  const j = await r.json();
  const p = j.places?.[0];
  if (!p) throw new Error('ZIP not found');
  return { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), label: `${p['place name']}, ${p['state abbreviation']} ${zip}` };
}

export async function geocodePlace(q: string): Promise<GeoHit> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q + ' Washington')}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('geocoder ' + r.status);
  const j = await r.json();
  const hit = j?.[0];
  if (!hit) throw new Error('Place not found');
  return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: (hit.name || hit.display_name || q).split(',')[0] };
}

export function locateMe(): Promise<GeoHit> {
  return new Promise((res, rej) => {
    if (!('geolocation' in navigator)) { rej(new Error('No GPS on this device')); return; }
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }),
      e => rej(new Error(e.code === 1 ? 'Location permission denied' : 'Could not get location')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
