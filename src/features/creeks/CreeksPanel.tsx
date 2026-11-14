import { useEffect, useMemo, useState } from 'react';
import type { Spot, SpotStatus } from '@/lib/types';
import type { StreamSeg } from '@/api/wdfw';
import type { StreamPick } from '@/store/ui';
import { CREEK_SPECIES, speciesColor, speciesLabel } from '@/data/species';
import { cToF, haversine, inPNW, regionOf } from '@/lib/util';
import { creekScore } from '@/domain/creekScore';
import { resolveZip, geocodePlace, locateMe } from '@/api/geocode';
import { toast } from '@/lib/toast';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { useCreeks, CREEK_MIN_ZOOM } from '@/features/creeks/store';
import type { Gauge } from '@/api/usgs';
import { Icon, Empty } from '@/components/ui';

const DOCUMENTED = /documented/i;
const MAX_STREAM_ROWS = 40;
const HOME = { lat: 47.171, lng: -122.518, label: 'Lakewood' };

/** Quick picks for the fish row. All seven is the default. */
const FISH_SETS: { id: string; label: string; ids: string[] }[] = [
  { id: 'all', label: 'All fish', ids: [] },
  { id: 'trout', label: 'Trout', ids: ['cutthroat', 'rainbow', 'brook', 'bull'] },
  { id: 'salmon', label: 'Salmon & steelhead', ids: ['coho', 'chinook', 'steelhead'] },
];

export const SPOT_STATUS: { id: SpotStatus; label: string; color: string }[] = [
  { id: 'candidate', label: 'Candidate', color: '#52c9e2' },
  { id: 'scouted', label: 'Scouted', color: '#eaa24c' },
  { id: 'producing', label: 'Producing', color: '#3fae6b' },
  { id: 'dead', label: 'Dead', color: '#5f7770' },
];
export function spotStatusColor(s: SpotStatus): string { return SPOT_STATUS.find(x => x.id === s)?.color || '#52c9e2'; }

export const ACCESS_LABEL: Record<string, string> = { public: 'Public', timber: 'Timber permit', private: 'Private', unknown: 'Access unknown' };

interface StreamGroup {
  llid: string;
  name: string;
  lat: number;
  lng: number;
  speciesIds: string[];
  docSpeciesCount: number;
  docMiles: number;
  docRows: number;
  presumedRows: number;
  rows: StreamPick['species'];
  totalMiles: number;
}

function groupStreams(segs: StreamSeg[]): StreamGroup[] {
  const map = new Map<string, StreamSeg[]>();
  for (const s of segs) { const key = s.llid || s.name; const arr = map.get(key) || []; arr.push(s); map.set(key, arr); }
  const out: StreamGroup[] = [];
  for (const [llid, rows] of map) {
    const uniq = new Map<string, StreamSeg>();
    for (const r of rows) { const k = `${r.swifd}|${r.dist}|${r.use}|${r.run}`; if (!uniq.has(k)) uniq.set(k, r); }
    const dedup = Array.from(uniq.values());
    const speciesIds = Array.from(new Set(dedup.map(r => r.species).filter(s => s !== 'other')));
    const docSpecies = new Set(dedup.filter(r => DOCUMENTED.test(r.dist)).map(r => r.species).filter(s => s !== 'other'));
    // Each SWIFD row carries the full length of that species' reach on the stream, so the longest documented row is the documented extent.
    let docMiles = 0; for (const r of dedup) if (DOCUMENTED.test(r.dist)) docMiles = Math.max(docMiles, r.miles);
    const first = rows[0];
    const c0 = first.coords[0]?.[0] || [0, 0];
    out.push({
      llid, name: first.name, lat: c0[0], lng: c0[1], speciesIds,
      docSpeciesCount: docSpecies.size, docMiles,
      docRows: dedup.filter(r => DOCUMENTED.test(r.dist)).length,
      presumedRows: dedup.filter(r => !DOCUMENTED.test(r.dist)).length,
      rows: dedup.map(r => ({ species: r.species, swifd: r.swifd, dist: r.dist, use: r.use, run: r.run, miles: r.miles })),
      totalMiles: Math.max(...rows.map(r => r.miles), 0),
    });
  }
  out.sort((a, b) => b.docSpeciesCount - a.docSpeciesCount || a.name.localeCompare(b.name));
  return out;
}

export function SpeciesBadges({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="pill-row" style={{ display: 'inline-flex', gap: 4 }}>
      {ids.map(id => <span key={id} className="badge" style={{ color: speciesColor(id) }}>{speciesLabel(id)}</span>)}
    </span>
  );
}

export function PriorityDots({ n }: { n: number }) {
  return (
    <span aria-label={`Priority ${n} of 5`} style={{ display: 'inline-flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => <i key={i} style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: i <= n ? 'var(--amber)' : 'var(--panel-raised)' }} />)}
    </span>
  );
}

export function CreeksPanel() {
  const creekSpecies = useUI(s => s.creekSpecies);
  const setCreekSpecies = useUI(s => s.setCreekSpecies);
  const setMapMode = useUI(s => s.setMapMode);
  const setMobileView = useUI(s => s.setMobileView);
  const openSheet = useUI(s => s.openSheet);
  const fly = useUI(s => s.fly);
  const origin = useUI(s => s.origin);
  const setOrigin = useUI(s => s.setOrigin);

  const streams = useCreeks(s => s.streams);
  const gauges = useCreeks(s => s.gauges);
  const barriers = useCreeks(s => s.barriers);
  const access = useCreeks(s => s.access);
  const loading = useCreeks(s => s.loading);
  const error = useCreeks(s => s.error);
  const zoom = useCreeks(s => s.zoom);
  const scope = useCreeks(s => s.scope);
  const showBarriers = useCreeks(s => s.showBarriers);
  const showGauges = useCreeks(s => s.showGauges);
  const showAccess = useCreeks(s => s.showAccess);
  const onlyDocumented = useCreeks(s => s.onlyDocumented);
  const toggle = useCreeks(s => s.toggle);
  const loadArea = useCreeks(s => s.loadArea);

  const spots = useData(s => s.spots);
  const index = useData(s => s.index);
  const profiles = useData(s => s.profiles);
  const me = currentUserId();

  const [statusFilter, setStatusFilter] = useState<SpotStatus | ''>('');
  const [mi, setMi] = useState(6);
  const [showFilters, setShowFilters] = useState(false);
  const [editPlace, setEditPlace] = useState(false);
  const [place, setPlace] = useState('');
  const [locating, setLocating] = useState(false);

  // The list centers on your start point, or Lakewood until you set one.
  const center = origin && inPNW(origin) ? { lat: origin.lat, lng: origin.lng, label: origin.label || 'your start point' } : HOME;
  const inOregon = regionOf(center) === 'OR';
  const speciesKey = creekSpecies.join(',');

  // Load creeks around the center without making you open the map. Skip it when the map is already
  // zoomed in on an area and the list is following it.
  useEffect(() => {
    const s = useCreeks.getState();
    if (s.scope?.kind === 'map' && s.zoom >= CREEK_MIN_ZOOM) return;
    loadArea(center.lat, center.lng, mi, center.label, creekSpecies);
    // Move the map there too, quietly, so it matches the list the next time you open it.
    useUI.setState({ flyTo: { lat: center.lat, lng: center.lng, zoom: mi > 8 ? 11 : 12, nonce: Date.now() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, mi, speciesKey]);

  function backToArea() {
    loadArea(center.lat, center.lng, mi, center.label, creekSpecies);
    useUI.setState({ flyTo: { lat: center.lat, lng: center.lng, zoom: mi > 8 ? 11 : 12, nonce: Date.now() } });
  }

  async function nearMe() {
    if (locating) return;
    setLocating(true);
    try { setOrigin(await locateMe()); setEditPlace(false); }
    catch (e) { toast((e as Error).message || 'Could not get your location', 'err'); }
    finally { setLocating(false); }
  }
  async function findPlace() {
    const v = place.trim(); if (!v || locating) return;
    setLocating(true);
    try {
      const hit = /^\d{5}$/.test(v) ? await resolveZip(v) : await geocodePlace(v);
      setOrigin(hit); setEditPlace(false); setPlace('');
    } catch (e) { toast((e as Error).message || `Could not find ${v}`, 'err'); }
    finally { setLocating(false); }
  }

  const ref = scope?.kind === 'area' ? scope : center;
  const groups = useMemo(() => groupStreams(onlyDocumented ? streams.filter(s => DOCUMENTED.test(s.dist)) : streams), [streams, onlyDocumented]);

  // Rank by the same Creek Score the stream sheet uses. The list skips flow history (one call per
  // gauge), so the sheet can land a few points off.
  const ranked = useMemo(() => groups.map(g => {
    let gauge: Gauge | null = null; let gd: number | null = null;
    for (const x of gauges) { const d = haversine(g.lat, g.lng, x.lat, x.lng); if (gd == null || d < gd) { gd = d; gauge = x; } }
    const sc = creekScore({ rows: g.rows, lat: g.lat, lng: g.lng, gauge, gaugeDist: gd, gaugeMedianCfs: null, barriers, access });
    return { g, score: sc.score, why: sc.why, d: haversine(ref.lat, ref.lng, g.lat, g.lng) };
  }).sort((a, b) => b.score - a.score || a.d - b.d), [groups, gauges, barriers, access, ref.lat, ref.lng]);

  const sortedGauges = useMemo(() => [...gauges].filter(g => g.cfs != null || g.tempC != null)
    .sort((a, b) => haversine(ref.lat, ref.lng, a.lat, a.lng) - haversine(ref.lat, ref.lng, b.lat, b.lng)).slice(0, 8), [gauges, ref.lat, ref.lng]);
  const sortedSpots = useMemo(() => {
    const list = statusFilter ? spots.filter(s => s.status === statusFilter) : spots;
    return [...list].sort((a, b) => (b.priority - a.priority) || (b.updated_at || '').localeCompare(a.updated_at || ''));
  }, [spots, statusFilter]);

  const fishSet = FISH_SETS.find(f => f.ids.length ? f.ids.length === creekSpecies.length && f.ids.every(id => creekSpecies.includes(id)) : creekSpecies.length === CREEK_SPECIES.length)?.id || 'custom';
  function pickSet(id: string) {
    const f = FISH_SETS.find(x => x.id === id); if (!f) return;
    setCreekSpecies(f.ids.length ? f.ids : [...CREEK_SPECIES]);
  }
  function toggleSpecies(id: string) {
    const next = creekSpecies.includes(id) ? creekSpecies.filter(x => x !== id) : [...creekSpecies, id];
    if (next.length) setCreekSpecies(next);
  }
  function showMap() { setMapMode('creeks'); setMobileView('map'); }
  function openStream(g: StreamGroup) {
    const pick: StreamPick = { llid: g.llid, name: g.name, lat: g.lat, lng: g.lng, species: g.rows, totalMiles: g.totalMiles };
    openSheet({ kind: 'stream', pick });
  }
  function openSpot(s: Spot) { openSheet({ kind: 'spot', spot: s }); }

  const mapScope = scope?.kind === 'map';
  const needZoom = mapScope && zoom < CREEK_MIN_ZOOM;
  const top = ranked[0];
  const rest = ranked.slice(1, MAX_STREAM_ROWS);
  const more = ranked.length - 1 - rest.length;
  const mapLayerCount = [showBarriers, showGauges, showAccess].filter(x => !x).length + (onlyDocumented ? 1 : 0) + (fishSet === 'custom' ? 1 : 0);
  const fmtMi = (d: number) => `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`;

  return (
    <>
      <div className="readout">
        <h2>Creeks</h2>
        <div className="rd">{mapScope ? 'Following the map' : `Within ${mi} mi`}<b>{loading ? '...' : `${ranked.length} creek${ranked.length === 1 ? '' : 's'}`}</b></div>
      </div>

      <div className="ck-area">
        <div className="ck-where">
          <Icon name="pin" size={16} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ck-k">{mapScope ? 'Showing' : 'Creeks near'}</div>
            <div className="ck-v">{mapScope ? 'What the map has in view' : ref.label || center.label}</div>
          </div>
          {mapScope
            ? <button type="button" className="btn sm" onClick={backToArea}>Near {center.label}</button>
            : <button type="button" className="btn sm ghost" onClick={() => setEditPlace(v => !v)} aria-expanded={editPlace}>Change</button>}
        </div>
        {editPlace && !mapScope && (
          <form className="row" onSubmit={e => { e.preventDefault(); findPlace(); }}>
            <button type="button" className="btn sm" onClick={nearMe} disabled={locating}><Icon name="locate" size={14} />Near me</button>
            <input className="input" type="text" inputMode="search" enterKeyHint="search" placeholder="ZIP or place" value={place} onChange={e => setPlace(e.target.value)} autoComplete="off" aria-label="ZIP or place" />
            <button type="submit" className="btn sm primary" disabled={locating || !place.trim()}>{locating ? <span className="spinner" /> : 'Go'}</button>
          </form>
        )}
        {!mapScope && (
          <div className="ck-seg" role="radiogroup" aria-label="How far">
            {[3, 6, 12].map(n => <button key={n} type="button" role="radio" aria-checked={mi === n} className={mi === n ? 'on' : ''} onClick={() => setMi(n)}>{n} mi</button>)}
          </div>
        )}
        <div className="ck-seg" role="radiogroup" aria-label="Fish">
          {FISH_SETS.map(f => <button key={f.id} type="button" role="radio" aria-checked={fishSet === f.id} className={fishSet === f.id ? 'on' : ''} onClick={() => pickSet(f.id)}>{f.label}</button>)}
          {fishSet === 'custom' && <button type="button" role="radio" aria-checked className="on" onClick={() => setShowFilters(true)}>{creekSpecies.length} picked</button>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`btn sm${showFilters ? ' primary' : ' ghost'}`} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}><Icon name="layers" size={14} />More filters{mapLayerCount ? ` (${mapLayerCount})` : ''}</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sm primary" onClick={showMap}><Icon name="map" size={14} />Map</button>
        </div>
        {showFilters && (
          <div className="ck-filters">
            <div className="ck-k">Species</div>
            <div className="ck-fish">
              {CREEK_SPECIES.map(id => {
                const on = creekSpecies.includes(id);
                return <button key={id} type="button" className={`ck-fishbtn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleSpecies(id)} style={{ ['--c' as string]: speciesColor(id) }}><i />{speciesLabel(id)}</button>;
              })}
            </div>
            <div className="ck-k">Show</div>
            <label className="ck-switch"><input type="checkbox" checked={onlyDocumented} onChange={() => toggle('onlyDocumented')} /><span>Documented fish only</span><small>Hides presumed and modeled reaches</small></label>
            <label className="ck-switch"><input type="checkbox" checked={showBarriers} onChange={() => toggle('showBarriers')} /><span>Fish barriers on the map</span></label>
            <label className="ck-switch"><input type="checkbox" checked={showGauges} onChange={() => toggle('showGauges')} /><span>Flow gauges on the map</span></label>
            <label className="ck-switch"><input type="checkbox" checked={showAccess} onChange={() => toggle('showAccess')} /><span>Public access sites on the map</span></label>
          </div>
        )}
      </div>

      {inOregon && !mapScope && <div className="note ck-warn">Creek data covers Washington only for now. WDFW maps the fish, and Oregon has not been added yet.</div>}
      {error && <div className="note ck-warn">{error}. <button type="button" className="btn sm ghost" onClick={backToArea}>Try again</button></div>}

      {loading && !ranked.length && (
        <div className="homefive" aria-busy="true">
          <div className="ck-skel hero-skel" />
          {[0, 1, 2].map(i => <div key={i} className="ck-skel" />)}
        </div>
      )}

      {needZoom && !loading && (
        <div className="ck-empty">
          <b>Zoom in on the map to see creeks</b>
          <span>The map is at zoom {zoom}. Creeks load at {CREEK_MIN_ZOOM} or closer.</span>
          <button type="button" className="btn sm" onClick={backToArea}>Show creeks near {center.label}</button>
        </div>
      )}

      {!loading && !needZoom && !error && ranked.length === 0 && (
        <div className="ck-empty">
          <b>No creeks with these fish here</b>
          <span>{fishSet === 'all' ? 'Try a wider radius.' : 'Try All fish or a wider radius.'}</span>
          {!mapScope && mi < 12 && <button type="button" className="btn sm" onClick={() => setMi(12)}>Search 12 mi</button>}
        </div>
      )}

      {top && (
        <>
          <button type="button" className="hero" onClick={() => openStream(top.g)}>
            <div className="hd">Best bet{mapScope ? ' in view' : ''} &middot; {fmtMi(top.d)} &middot; tap for the full score</div>
            <div className="hrow"><span className="hnm">{top.g.name}</span><span className="hsc">{top.score}</span></div>
            <div className="ck-herofish">{top.g.speciesIds.slice(0, 4).map(id => <span key={id}><i style={{ background: speciesColor(id) }} />{speciesLabel(id)}</span>)}</div>
            <div className="hm">{top.why}</div>
          </button>
          <div className="homefive">
            {rest.map(x => (
              <button key={x.g.llid} type="button" className="prow" onClick={() => openStream(x.g)}>
                <span className="pscore" style={{ color: x.score >= 70 ? '#0e9c52' : x.score >= 50 ? 'var(--amber)' : 'var(--muted)', borderColor: 'currentColor' }}>{x.score}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="pname" style={{ display: 'block' }}>{x.g.name}</span>
                  <span className="ck-rowsp">{x.g.speciesIds.slice(0, 4).map(id => <span key={id}><i style={{ background: speciesColor(id) }} />{speciesLabel(id)}</span>)}{x.g.speciesIds.length === 0 && <span>Other fish</span>}</span>
                  <span className="ck-rowfish">{[fmtMi(x.d), x.g.docMiles > 0 ? `${x.g.docMiles.toFixed(1)} mi documented` : 'presumed only'].join(' · ')}</span>
                </span>
              </button>
            ))}
            {more > 0 && <div className="note" style={{ textAlign: 'center' }}>{more} more lower down. {mapScope ? 'Zoom in' : 'Pick a smaller radius'} to narrow it.</div>}
          </div>
        </>
      )}

      {sortedGauges.length > 0 && (
        <div className="section">
          <h3>River flow now <small>USGS gauges</small></h3>
          <div className="ck-gauges">
            {sortedGauges.map(g => (
              <button key={g.id} type="button" className="ck-gauge" onClick={() => fly(g.lat, g.lng, 13)}>
                <span className="ck-gn">{g.name}</span>
                <b>{g.cfs != null ? `${Math.round(g.cfs).toLocaleString()} cfs` : 'no flow'}</b>
                <small>{g.tempC != null ? `${Math.round(cToF(g.tempC))}°F water` : 'no temp'} &middot; {fmtMi(haversine(ref.lat, ref.lng, g.lat, g.lng))}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h3>Your spots <small>{spots.length ? `${sortedSpots.length}${statusFilter ? ` of ${spots.length}` : ''}` : ''}</small></h3>
        {spots.length >= 3 && (
          <div className="ck-seg" style={{ marginBottom: 8 }} role="radiogroup" aria-label="Spot status">
            <button type="button" role="radio" aria-checked={statusFilter === ''} className={statusFilter === '' ? 'on' : ''} onClick={() => setStatusFilter('')}>All</button>
            {SPOT_STATUS.map(s => <button key={s.id} type="button" role="radio" aria-checked={statusFilter === s.id} className={statusFilter === s.id ? 'on' : ''} onClick={() => setStatusFilter(statusFilter === s.id ? '' : s.id)}>{s.label}</button>)}
          </div>
        )}
        <div className="list">
          {spots.length === 0 && <div className="ck-empty small"><b>No spots saved yet</b><span>Open a creek above and tap Save as spot to track it from candidate to producing.</span></div>}
          {spots.length > 0 && sortedSpots.length === 0 && <Empty>No spots with that status.</Empty>}
          {sortedSpots.map(s => {
            const st = index[s.id];
            const mine = s.user_id === me;
            const owner = !mine ? (profiles[s.user_id]?.name || 'Crew') : null;
            return (
              <div key={s.id} className="item" role="button" tabIndex={0} onClick={() => openSpot(s)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpot(s); } }}>
                <span className="pin" style={{ background: spotStatusColor(s.status) }} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">
                    {s.name}
                    {owner && <> <span className="badge water">{owner}</span></>}
                  </div>
                  <div className="sub" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <SpeciesBadges ids={s.species} />
                    <span>{ACCESS_LABEL[s.access] || s.access}{s.permit ? `, ${s.permit}` : ''}</span>
                  </div>
                  <div className="sub" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <PriorityDots n={s.priority} />
                    <span>{SPOT_STATUS.find(x => x.id === s.status)?.label || s.status}</span>
                  </div>
                </div>
                <div className="right">
                  {st && (st.catches > 0 || st.visits > 0) ? (
                    <><b>{st.catches} {st.catches === 1 ? 'catch' : 'catches'}</b>{st.visits} {st.visits === 1 ? 'visit' : 'visits'}</>
                  ) : <span>no visits</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="note ck-about">
        Fish data: WDFW stream fish distribution (SWIFD). Creek Score weighs documented fish, cold water, barriers, public access and flow. List scores skip flow history, so the creek sheet can land a few points off. On the map, solid lines are documented fish and dashed lines are presumed.
      </div>
    </>
  );
}
