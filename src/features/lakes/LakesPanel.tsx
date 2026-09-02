import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Lake } from '@/lib/types';
import { LAKES, COUNTIES } from '@/data/lakes';
import { LAKE_SPECIES, CATS, speciesColor, speciesLabel } from '@/data/species';
import { tagKey } from '@/lib/db';
import { toast } from '@/lib/toast';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { useLakes, filterLakes, type SortKey } from '@/features/lakes/store';
import { lakeSub } from '@/domain/journal';
import { haversine } from '@/lib/util';
import { resolveZip, geocodePlace, locateMe } from '@/api/geocode';
import { Chip, Icon, Empty } from '@/components/ui';

const FLAG_CHIPS: { k: keyof ReturnType<typeof useLakes.getState>['flags']; label: string }[] = [
  { k: 'fav', label: 'Favorites' },
  { k: 'wish', label: 'Wish list' },
  { k: 'ramp', label: 'Has ramp' },
  { k: 'motor', label: 'Motors OK' },
  { k: 'visited', label: 'Visited' },
  { k: 'caught', label: 'Caught here' },
  { k: 'crew', label: 'Crew picks' },
];

function isMobile(): boolean { return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches; }

export function LakesPanel() {
  const q = useLakes(s => s.q);
  const county = useLakes(s => s.county);
  const sort = useLakes(s => s.sort);
  const species = useLakes(s => s.species);
  const cat = useLakes(s => s.cat);
  const flags = useLakes(s => s.flags);
  const launches = useLakes(s => s.launches);
  const launchStatus = useLakes(s => s.launchStatus);
  const setQ = useLakes(s => s.setQ);
  const setCounty = useLakes(s => s.setCounty);
  const setSort = useLakes(s => s.setSort);
  const setSpecies = useLakes(s => s.setSpecies);
  const setCat = useLakes(s => s.setCat);
  const toggleFlag = useLakes(s => s.toggleFlag);

  const origin = useUI(s => s.origin);
  const setOrigin = useUI(s => s.setOrigin);
  const activeLakeId = useUI(s => s.activeLakeId);

  const tags = useData(s => s.tags);
  const index = useData(s => s.index);

  const [place, setPlace] = useState('');
  const [locating, setLocating] = useState(false);

  const me = currentUserId();

  // filterLakes reads the stores directly; the deps make sure it re-runs when any input changes.
  const lakes = useMemo(() => filterLakes(), [q, county, sort, species, cat, flags, launches, origin, tags, index]);

  const anyFilter = !!(q || county || species || cat || Object.values(flags).some(Boolean));

  function applyOrigin(o: { lat: number; lng: number; label: string }) {
    setOrigin(o);
    setSort('dist');
  }
  function clearOrigin() {
    setOrigin(null);
    if (sort === 'dist') setSort('name');
  }
  async function nearMe() {
    if (locating) return;
    setLocating(true);
    try { applyOrigin(await locateMe()); toast('Sorted by distance from you'); }
    catch (e) { toast((e as Error).message || 'Could not get your location', 'err'); }
    finally { setLocating(false); }
  }
  async function findPlace() {
    const v = place.trim();
    if (!v) return;
    if (/^\d+$/.test(v) && !/^\d{5}$/.test(v)) { toast('Enter a 5 digit ZIP', 'warn'); return; }
    if (!/^\d{5}$/.test(v) && v.length < 3) { toast('Type at least 3 letters', 'warn'); return; }
    setLocating(true);
    try {
      const hit = /^\d{5}$/.test(v) ? await resolveZip(v) : await geocodePlace(v);
      applyOrigin(hit);
      toast(`Lakes near ${hit.label}`);
    } catch (e) { toast((e as Error).message || `Could not find ${v}`, 'err'); }
    finally { setLocating(false); }
  }
  function resetFilters() {
    setQ(''); setCounty(''); setSpecies(''); setCat('');
    (Object.keys(flags) as (keyof typeof flags)[]).forEach(k => { if (flags[k]) toggleFlag(k); });
  }

  function pinColor(l: Lake): string {
    const t = me ? tags[tagKey(me, l.slug)] : undefined;
    if (t?.color) return t.color;
    const top = index[l.slug]?.top;
    if (top) return speciesColor(top);
    return speciesColor(l.sp[0] || 'other');
  }

  function pick(l: Lake) {
    useUI.getState().setActiveLake(l.id);
    if (isMobile()) useUI.getState().setMobileView('map');
  }
  function open(e: MouseEvent, l: Lake) {
    e.stopPropagation();
    useUI.getState().openSheet({ kind: 'lake', lake: l });
  }
  function onRowKey(e: KeyboardEvent<HTMLDivElement>, l: Lake) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(l); }
  }

  return (
    <>
      <div className="controls">
        <input className="input" type="search" placeholder="Search lake or county" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" aria-label="Search lakes" />
        <div className="row">
          <select className="select" value={county} onChange={e => setCounty(e.target.value)} aria-label="County">
            <option value="">All counties</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="name">A to Z</option>
            <option value="acres">Largest first</option>
            <option value="dist" disabled={!origin}>Nearest first</option>
            <option value="catches">Most catches</option>
            <option value="visits">Most visits</option>
          </select>
        </div>
        <div className="row">
          <select className="select" value={species} onChange={e => setSpecies(e.target.value)} aria-label="Species">
            <option value="">All species</option>
            {LAKE_SPECIES.map(id => <option key={id} value={id}>{speciesLabel(id)}</option>)}
          </select>
          <select className="select" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">
            <option value="">Any tag</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="chips">
          {FLAG_CHIPS.map(f => <Chip key={f.k} on={flags[f.k]} onClick={() => toggleFlag(f.k)}>{f.label}</Chip>)}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={nearMe} disabled={locating}><Icon name="locate" />Near me</button>
          <input
            className="input"
            type="text"
            placeholder="ZIP or place"
            value={place}
            onChange={e => setPlace(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); findPlace(); } }}
            autoComplete="off"
            aria-label="ZIP or place"
          />
        </div>
        {origin && (
          <div className="row">
            <span className="note" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Distances from {origin.label}</span>
            <button type="button" className="btn sm ghost" onClick={clearOrigin} aria-label="Clear origin"><Icon name="close" />Clear</button>
          </div>
        )}
      </div>

      <div className="legend">
        {LAKE_SPECIES.map(id => <span key={id}><i style={{ background: speciesColor(id) }} />{speciesLabel(id)}</span>)}
        <span><i style={{ background: 'transparent', boxShadow: '0 0 0 2px var(--amber)' }} />Favorite</span>
        <span><i style={{ background: 'transparent', boxShadow: '0 0 0 2px var(--water)' }} />Wish list</span>
      </div>

      <div className="meta">
        <span>{lakes.length} of {LAKES.length} shown{anyFilter && <> · <button type="button" className="btn sm ghost" style={{ padding: '0 4px', fontSize: 12 }} onClick={resetFilters}>Reset</button></>}</span>
        <small style={{ textAlign: 'right' }}>{launchStatus}</small>
      </div>

      <div className="list">
        {lakes.length === 0 && <Empty>No lakes match. Try clearing the filters.</Empty>}
        {lakes.map(l => {
          const t = me ? tags[tagKey(me, l.slug)] : undefined;
          const st = index[l.slug];
          const launch = launches[l.slug];
          const color = pinColor(l);
          const ring = t?.fav ? 'var(--amber)' : t?.wish ? 'var(--water)' : null;
          let sub = lakeSub(l);
          if (origin) sub += ` · ${haversine(origin.lat, origin.lng, l.lat, l.lng).toFixed(1)} mi`;
          if (launch) sub += ` · ${launch.type || 'ramp'}`;
          return (
            <div
              key={l.id}
              className={`item${activeLakeId === l.id ? ' active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => pick(l)}
              onKeyDown={e => onRowKey(e, l)}
            >
              <span className="pin" style={{ background: color, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">
                  {l.name}{t?.fav ? ' ★' : ''}{t?.wish ? ' ♡' : ''}
                  {t?.cat && <> <span className="badge">{t.cat}</span></>}
                </div>
                <div className="sub">{sub}</div>
              </div>
              <div className="right">
                {st && (st.catches > 0 || st.visits > 0) && (
                  <><b>{st.catches} {st.catches === 1 ? 'catch' : 'catches'}</b>{st.visits} {st.visits === 1 ? 'visit' : 'visits'}</>
                )}
                <div style={{ marginTop: st ? 4 : 0 }}>
                  <button type="button" className="btn sm ghost" onClick={e => open(e, l)} aria-label={`Open ${l.name}`}>Open</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
