import { useEffect, useMemo, useState } from 'react';
import type { Hike } from '@/domain/hikes';
import { sacLabel } from '@/api/trails';
import { speciesColor, speciesLabel } from '@/data/species';
import { haversine, dirUrl, lsGet, lsSet } from '@/lib/util';
import { toast } from '@/lib/toast';
import { useUI } from '@/store/ui';
import { useHikes } from '@/features/hikes/store';
import { Chip, Icon, Empty } from '@/components/ui';

type Effort = 'short' | 'moderate' | 'any';

export function HikesPlan() {
  const origin = useUI(s => s.origin);
  const setOrigin = useUI(s => s.setOrigin);
  const fly = useUI(s => s.fly);
  const openSheet = useUI(s => s.openSheet);
  const hikes = useHikes(s => s.areaHikes);
  const loading = useHikes(s => s.areaLoading);
  const error = useHikes(s => s.areaError);
  const loadArea = useHikes(s => s.loadArea);
  const setShowTrails = useHikes(s => s.setShowTrails);
  const [effort, setEffort] = useState<Effort>(() => (lsGet('wff-hike-effort') as Effort) || 'short');
  const [highOnly, setHighOnly] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => { lsSet('wff-hike-effort', effort); }, [effort]);
  useEffect(() => { if (origin) loadArea(origin.lat, origin.lng); }, [origin, loadArea]);

  const list = useMemo(() => {
    if (!origin) return [];
    const seen = new Set<string>();
    return hikes
      .filter(h => effort === 'any' || (effort === 'short' ? h.effort === 'short' : h.effort !== 'long'))
      .filter(h => !highOnly || h.lake.kind === 'high')
      .map(h => ({ h, drive: haversine(origin.lat, origin.lng, h.trailhead.lat, h.trailhead.lng) }))
      .sort((a, b) => a.drive - b.drive || a.h.miles - b.h.miles)
      .filter(x => { const k = x.h.trail.name.toLowerCase() + '|' + x.h.lake.slug; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 80);
  }, [hikes, origin, effort, highOnly]);

  const nearMe = () => {
    if (!navigator.geolocation) { toast('Location not available', 'warn'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }); },
      () => { setLocating(false); toast('Could not get your location', 'warn'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const showOnMap = (h: Hike) => { setShowTrails(true); fly(h.lake.lat, h.lake.lng, 14); };

  return (
    <div>
      <div className="section" style={{ marginTop: 8 }}>
        <h3>Hikes to fishing lakes <small>{origin ? `within about 35 mi of ${origin.label}` : 'set a start point'}</small></h3>
        {!origin && (
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn primary" onClick={nearMe} disabled={locating}><Icon name="locate" size={16} />{locating ? 'Locating' : 'Near me'}</button>
            <span className="note">Or set a ZIP or place on the Lakes tab.</span>
          </div>
        )}
        <div className="chips" style={{ marginBottom: 8 }}>
          <Chip on={effort === 'short'} onClick={() => setEffort('short')}>Short, under 3 mi</Chip>
          <Chip on={effort === 'moderate'} onClick={() => setEffort('moderate')}>Under 6 mi</Chip>
          <Chip on={effort === 'any'} onClick={() => setEffort('any')}>Any length</Chip>
          <Chip on={highOnly} onClick={() => setHighOnly(v => !v)}>High lakes only</Chip>
        </div>
        <div className="note" style={{ paddingBottom: 8 }}>
          Named trails from OpenStreetMap that come within a short walk of a WDFW fishing lake. Miles are the trail length inside the search area; a trail that ends at the lake reads as one way. Trailhead is the far end of the trail, so check the map before you drive.
        </div>
        {loading && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Loading trails</div>}
        {error && <div className="row" style={{ justifyContent: 'space-between' }}><div className="note">Trails did not load: {error}</div>{origin && <button className="btn sm" onClick={() => { useHikes.setState({ areaKey: null }); loadArea(origin.lat, origin.lng); }}>Retry</button>}</div>}
        {origin && !loading && !error && !list.length && <Empty>No trail-to-lake matches with these filters. Try Any length or move the start point.</Empty>}
        <div className="list">
          {list.map(({ h, drive }) => (
            <div key={h.id} className="item" style={{ gridTemplateColumns: '1fr', cursor: 'default' }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{h.trail.name}</div>
                    <div className="sub">{h.miles} mi trail{h.trail.sac ? ` - ${sacLabel(h.trail.sac)}` : ''} - trailhead {Math.round(drive)} mi away</div>
                  </div>
                  <span className={`badge ${h.effort === 'short' ? 'ok' : h.effort === 'moderate' ? 'warn' : ''}`}>{h.effort}</span>
                </div>
                <div className="sub" style={{ marginTop: 6, color: 'var(--ink)' }}>
                  <b>{h.lake.name}</b> - {h.lake.acres ? `${Math.round(h.lake.acres)} ac, ` : ''}{h.lake.elev.toLocaleString()} ft{h.lake.kind === 'high' ? ', high lake' : ''}{h.lakeGapMi > 0.02 ? `, trail ends ${h.lakeGapMi} mi from the water` : ''}
                </div>
                <div className="pill-row" style={{ marginTop: 4 }}>
                  {h.lake.sp.slice(0, 5).map(s => <span key={s} className="badge" style={{ color: speciesColor(s) }}>{speciesLabel(s)}</span>)}
                  {!h.lake.sp.length && <span className="badge">species not listed</span>}
                </div>
                <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => showOnMap(h)}><Icon name="map" size={14} />Map</button>
                  <button className="btn sm ghost" onClick={() => openSheet({ kind: 'lake', lake: h.lake })}>Lake</button>
                  <a className="btn sm ghost" href={dirUrl(h.trailhead.lat, h.trailhead.lng)} target="_blank" rel="noopener"><Icon name="nav" size={14} />Trailhead</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
