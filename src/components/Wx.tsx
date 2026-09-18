import { useEffect, useState } from 'react';
import { useUI } from '@/store/ui';

type W = { t: number; w: number; baro: number; trend: number; code: number };
const HOME = { lat: 47.171, lng: -122.518 }; // Lakewood fallback until an origin is set

function icon(code: number) {
  if (code >= 51) return <svg viewBox="0 0 24 24"><path d="M7 15.5a4.5 4.5 0 0 1 8.7-1.6 3.5 3.5 0 0 1-.7 6.9H10a3.8 3.8 0 0 1-3-5.3z" /><path d="M9 23l1-2M13 23l1-2" /></svg>;
  if (code >= 2) return <svg viewBox="0 0 24 24"><circle cx="8.5" cy="9" r="3.4" /><path d="M8.5 2.8v1.6M2.8 9h1.6M4.6 4.9l1.1 1.1" /><path d="M7 17.5a4.5 4.5 0 0 1 8.7-1.6 3.5 3.5 0 0 1-.7 6.9H10a3.8 3.8 0 0 1-3-5.3z" /></svg>;
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4" /><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" /></svg>;
}

export function Wx() {
  const [wx, setWx] = useState<W | null>(null);
  const setTab = useUI(s => s.setTab);
  const origin = useUI(s => s.origin);

  useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const o = origin || HOME;
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${o.lat}&longitude=${o.lng}&current=temperature_2m,wind_speed_10m,weather_code,surface_pressure&hourly=surface_pressure&past_hours=4&forecast_hours=1&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const r = await fetch(u);
        if (!r.ok) return;
        const j = await r.json();
        const c = j.current;
        if (!c) return;
        const hp: number[] = j.hourly?.surface_pressure || [];
        const trend = hp.length > 1 && hp[0] != null ? c.surface_pressure - hp[0] : 0;
        if (!dead) setWx({ t: Math.round(c.temperature_2m), w: Math.round(c.wind_speed_10m), baro: c.surface_pressure * 0.02953, trend, code: c.weather_code ?? 0 });
      } catch { /* widget stays hidden on failure */ }
    }
    load();
    const iv = setInterval(load, 30 * 60e3);
    return () => { dead = true; clearInterval(iv); };
  }, [origin]);

  if (!wx) return null;
  const up = wx.trend > 0.5, dn = wx.trend < -0.5;
  return (
    <button type="button" className="wx" onClick={() => setTab('plan')} aria-label={`Weather ${wx.t} degrees, wind ${wx.w}, open Plan`}>
      {icon(wx.code)}
      <span className="col">
        <b>{wx.t}&deg;</b>
        <small>{wx.w} MPH <span className={`baro ${up ? 'up' : dn ? 'dn' : ''}`}>&middot; {wx.baro.toFixed(2)} {up ? '\u25b2' : dn ? '\u25bc' : '\u2500'}</span></small>
      </span>
    </button>
  );
}
