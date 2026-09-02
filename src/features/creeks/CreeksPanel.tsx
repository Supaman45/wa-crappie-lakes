import { useMemo, useState } from 'react';
import type { Spot, SpotStatus } from '@/lib/types';
import type { StreamSeg } from '@/api/wdfw';
import type { StreamPick } from '@/store/ui';
import { CREEK_SPECIES, speciesColor, speciesLabel } from '@/data/species';
import { cToF } from '@/lib/util';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { useCreeks, CREEK_MIN_ZOOM } from '@/features/creeks/store';
import { Chip, Icon, Empty } from '@/components/ui';

const DOCUMENTED = /documented/i;
const MAX_STREAM_ROWS = 60;

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

  const streams = useCreeks(s => s.streams);
  const gauges = useCreeks(s => s.gauges);
  const barriers = useCreeks(s => s.barriers);
  const access = useCreeks(s => s.access);
  const loading = useCreeks(s => s.loading);
  const error = useCreeks(s => s.error);
  const zoom = useCreeks(s => s.zoom);
  const showBarriers = useCreeks(s => s.showBarriers);
  const showGauges = useCreeks(s => s.showGauges);
  const showAccess = useCreeks(s => s.showAccess);
  const onlyDocumented = useCreeks(s => s.onlyDocumented);
  const toggle = useCreeks(s => s.toggle);

  const spots = useData(s => s.spots);
  const index = useData(s => s.index);
  const profiles = useData(s => s.profiles);
  const me = currentUserId();

  const [statusFilter, setStatusFilter] = useState<SpotStatus | ''>('');

  const groups = useMemo(() => groupStreams(onlyDocumented ? streams.filter(s => DOCUMENTED.test(s.dist)) : streams), [streams, onlyDocumented]);
  const sortedGauges = useMemo(() => [...gauges].sort((a, b) => a.name.localeCompare(b.name)), [gauges]);
  const sortedSpots = useMemo(() => {
    const list = statusFilter ? spots.filter(s => s.status === statusFilter) : spots;
    return [...list].sort((a, b) => (b.priority - a.priority) || (b.updated_at || '').localeCompare(a.updated_at || ''));
  }, [spots, statusFilter]);

  function toggleSpecies(id: string) {
    setCreekSpecies(creekSpecies.includes(id) ? creekSpecies.filter(x => x !== id) : [...creekSpecies, id]);
  }
  function showMap() { setMapMode('creeks'); setMobileView('map'); }
  function openStream(g: StreamGroup) {
    const pick: StreamPick = { llid: g.llid, name: g.name, lat: g.lat, lng: g.lng, species: g.rows, totalMiles: g.totalMiles };
    openSheet({ kind: 'stream', pick });
  }
  function openSpot(s: Spot) { openSheet({ kind: 'spot', spot: s }); }

  const needZoom = zoom < CREEK_MIN_ZOOM;
  const shown = groups.slice(0, MAX_STREAM_ROWS);
  const more = groups.length - shown.length;

  return (
    <>
      <div className="controls">
        <div className="note">
          Streams come from WDFW fish distribution data (SWIFD). Solid lines are documented, dashed lines are presumed or modeled. Zoom the map to 11 or closer over an area, then tap a stream for details and a Creek Score.
        </div>
        <div className="chips" aria-label="Species">
          {CREEK_SPECIES.map(id => <Chip key={id} on={creekSpecies.includes(id)} color={speciesColor(id)} onClick={() => toggleSpecies(id)}>{speciesLabel(id)}</Chip>)}
        </div>
        <div className="chips" aria-label="Layers">
          <Chip on={showBarriers} onClick={() => toggle('showBarriers')}>Barriers</Chip>
          <Chip on={showGauges} onClick={() => toggle('showGauges')}>Gauges</Chip>
          <Chip on={showAccess} onClick={() => toggle('showAccess')}>Access</Chip>
          <Chip on={onlyDocumented} onClick={() => toggle('onlyDocumented')}>Documented only</Chip>
        </div>
        <div className="row">
          <span className="note" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {loading ? <><span className="spinner" /> Loading streams</>
              : needZoom ? <>Zoom in to load streams (zoom {zoom} of {CREEK_MIN_ZOOM})</>
              : error ? <span style={{ color: 'var(--amber)' }}>{error}</span>
              : <>{streams.length} segments, {gauges.length} gauges, {barriers.length} barriers, {access.length} access sites</>}
          </span>
          <button type="button" className="btn sm primary" onClick={showMap}><Icon name="map" />Show map</button>
        </div>
      </div>

      <div className="section">
        <h3>Gauges in view <small>{sortedGauges.length}</small></h3>
        <div className="list">
          {sortedGauges.length === 0 && <Empty>{needZoom ? 'Zoom in on the map to see gauges.' : 'No USGS gauges in view.'}</Empty>}
          {sortedGauges.map(g => (
            <div key={g.id} className="item" role="button" tabIndex={0} onClick={() => fly(g.lat, g.lng, 13)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fly(g.lat, g.lng, 13); } }}>
              <span className="pin" style={{ background: 'var(--water)' }} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{g.name}</div>
                <div className="sub">USGS {g.id}</div>
              </div>
              <div className="right">
                <b>{g.cfs != null ? `${Math.round(g.cfs).toLocaleString()} cfs` : 'no flow'}</b>
                {g.tempC != null ? `${Math.round(cToF(g.tempC))}°F` : 'no temp'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Streams in view <small>{groups.length}</small></h3>
        <div className="list">
          {groups.length === 0 && <Empty>{needZoom ? 'Zoom in on the map to load streams.' : loading ? 'Loading streams.' : 'No streams match the species filter here.'}</Empty>}
          {shown.map(g => (
            <div key={g.llid} className="item" role="button" tabIndex={0} onClick={() => openStream(g)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStream(g); } }}>
              <span className="pin" style={{ background: speciesColor(g.speciesIds[0] || 'other') }} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{g.name}</div>
                <div className="sub" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <SpeciesBadges ids={g.speciesIds} />
                  {g.speciesIds.length === 0 && <span>Other species</span>}
                </div>
              </div>
              <div className="right">
                <b>{g.docMiles > 0 ? `${g.docMiles.toFixed(1)} mi doc.` : 'not documented'}</b>
                {g.docRows} doc, {g.presumedRows} presumed
              </div>
            </div>
          ))}
          {more > 0 && <div className="note" style={{ textAlign: 'center' }}>and {more} more. Zoom in to narrow the list.</div>}
        </div>
      </div>

      <div className="section">
        <h3>My spots <small>{sortedSpots.length}{statusFilter ? ` of ${spots.length}` : ''}</small></h3>
        <div className="chips" style={{ marginBottom: 8 }}>
          <Chip on={statusFilter === ''} onClick={() => setStatusFilter('')}>All</Chip>
          {SPOT_STATUS.map(s => <Chip key={s.id} on={statusFilter === s.id} color={s.color} onClick={() => setStatusFilter(statusFilter === s.id ? '' : s.id)}>{s.label}</Chip>)}
        </div>
        <div className="list">
          {sortedSpots.length === 0 && <Empty>{spots.length === 0 ? 'No saved spots yet. Tap a stream on the map and choose Save as spot.' : 'No spots with that status.'}</Empty>}
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
    </>
  );
}
