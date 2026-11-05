import { useMemo, useState } from 'react';
import { LAKES } from '@/data/lakes';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { haversine } from '@/lib/util';
import { locateMe } from '@/api/geocode';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/ui';
import { QuickCatch, TripBar, type QuickWater } from './QuickCatch';
import type { Lake } from '@/lib/types';

const HOME = { lat: 47.171, lng: -122.518 }; // Lakewood, until a start point or GPS fix exists

function lakeWater(l: Lake): QuickWater {
  return { id: l.slug, name: l.name, type: 'lake', spotId: null, lat: l.lat, lng: l.lng, species: l.sp };
}

/**
 * The center Log button used to land on the Catch Record Card, with no way to log a fish unless a
 * trip was already running. Two months in, the crew had logged one catch. This answers "where are
 * you?" in one tap: your recent waters first, then the closest lakes, then search. Pick one and the
 * species chips appear, the same one-tap QuickCatch the lake sheet uses.
 */
export function WaterPick() {
  const catches = useData(s => s.catches);
  const visits = useData(s => s.visits);
  const origin = useUI(s => s.origin);
  const setOrigin = useUI(s => s.setOrigin);
  const [picked, setPicked] = useState<QuickWater | null>(null);
  const [q, setQ] = useState('');
  const [locating, setLocating] = useState(false);
  const me = currentUserId();

  const bySlug = useMemo(() => {
    const m: Record<string, Lake> = {};
    for (const l of LAKES) m[l.slug] = l;
    return m;
  }, []);

  const recent = useMemo(() => {
    const rows = [...catches, ...visits]
      .filter(r => r.user_id === me && (r.water_type ?? 'lake') === 'lake' && bySlug[r.lake_id])
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const seen = new Set<string>(); const out: Lake[] = [];
    for (const r of rows) { if (seen.has(r.lake_id)) continue; seen.add(r.lake_id); out.push(bySlug[r.lake_id]); if (out.length >= 3) break; }
    return out;
  }, [catches, visits, me, bySlug]);

  const nearby = useMemo(() => {
    const o = origin || HOME;
    const skip = new Set(recent.map(l => l.slug));
    return LAKES.filter(l => l.kind !== 'high' && !skip.has(l.slug))
      .map(l => ({ l, d: haversine(o.lat, o.lng, l.lat, l.lng) }))
      .sort((a, b) => a.d - b.d).slice(0, 5);
  }, [origin, recent]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return LAKES.filter(l => l.name.toLowerCase().includes(s)).slice(0, 6);
  }, [q]);

  async function nearMe() {
    if (locating) return;
    setLocating(true);
    try { setOrigin(await locateMe()); }
    catch (e) { toast((e as Error).message || 'Could not get your location', 'err'); }
    finally { setLocating(false); }
  }

  if (picked) {
    return (
      <div className="logstart">
        <div className="ls-head">
          <div><div className="ls-k">Logging at</div><div className="ls-w">{picked.name}</div></div>
          <button type="button" className="btn sm ghost" onClick={() => setPicked(null)}>Change</button>
        </div>
        <QuickCatch water={picked} />
        <TripBar water={picked} />
      </div>
    );
  }

  const chip = (l: Lake, sub: string) => (
    <button key={l.slug} type="button" className="ls-chip" onClick={() => setPicked(lakeWater(l))}>
      <b>{l.name}</b><small>{sub}</small>
    </button>
  );

  return (
    <div className="logstart">
      <div className="ls-head">
        <div><div className="ls-k">Log a fish</div><div className="ls-w">Where are you?</div></div>
        <button type="button" className="btn sm" onClick={nearMe} disabled={locating}>{locating ? <span className="spinner" /> : <Icon name="locate" size={14} />}Near me</button>
      </div>
      {recent.length > 0 && <div className="ls-row">{recent.map(l => chip(l, 'your water'))}</div>}
      <div className="ls-row">
        {nearby.map(({ l, d }) => chip(l, `${d < 10 ? d.toFixed(1) : Math.round(d)} mi${origin ? '' : ' from Lakewood'}`))}
      </div>
      <input className="input" type="search" placeholder="Another lake..." value={q} onChange={e => setQ(e.target.value)} autoComplete="off" aria-label="Search for a lake to log at" />
      {matches.length > 0 && <div className="ls-row">{matches.map(l => chip(l, l.counties?.[0] || ''))}</div>}
      <div className="note">Rivers and creeks: open the river in Plan or the stream on the Creeks map, and log from there.</div>
    </div>
  );
}
