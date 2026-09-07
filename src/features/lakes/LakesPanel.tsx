import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Lake } from '@/lib/types';
import { LAKES, COUNTIES } from '@/data/lakes';
import { LAKE_SPECIES, CORE_LAKE_SPECIES, CATS, speciesColor, speciesLabel } from '@/data/species';
import { tagKey } from '@/lib/db';
import { toast } from '@/lib/toast';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { useLakes, filterLakes, type SortKey, type SizeKey } from '@/features/lakes/store';
import { useFeeds } from '@/store/feeds';
import { boatFit } from '@/domain/boatFit';
import { solunarSummary } from '@/domain/scoring';
import { InstallBanner } from '@/features/more/Install';
import { lakeSub } from '@/domain/journal';
import { haversine } from '@/lib/util';
import { resolveZip, geocodePlace, locateMe } from '@/api/geocode';
import { Chip, Icon, Empty } from '@/components/ui';

const FLAG_CHIPS: { k: keyof ReturnType<typeof useLakes.getState>['flags']; label: string }[] = [
  { k: 'bigBoat', label: '17 ft boat' },
  { k: 'smallBoat', label: 'Electric boat' },
  { k: 'high', label: 'Hike-in lakes' },
  { k: 'fav', label: 'Favorites' },
  { k: 'wish', label: 'Wish list' },
  { k: 'ramp', label: 'Has ramp' },
  { k: 'motor', label: 'Motors OK' },
  { k: 'visited', label: 'Visited' },
  { k: 'caught', label: 'Caught here' },
  { k: 'crew', label: 'Crew picks' },
  { k: 'stocked', label: 'Stocked lately' },
];

const LIST_CAP = 300;

function isMobile(): boolean { return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches; }

export function LakesPanel() {
  const q = useLakes(s => s.q);
  const county = useLakes(s => s.county);
  const sort = useLakes(s => s.sort);
  const species = useLakes(s => s.species);
  const cat = useLakes(s => s.cat);
  const size = useLakes(s => s.size);
  const setSize = useLakes(s => s.setSize);
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
  const [showFilters, setShowFilters] = useState(() => !isMobile());
  const [locating, setLocating] = useState(false);

  const me = currentUserId();

  // filterLakes reads the stores directly; the deps make sure it re-runs when any input changes.
  const plants = useFeeds(s => s.plants);
  const loadPlants = useFeeds(s => s.loadPlants);
  useEffect(() => { if (flags.stocked && useFeeds.getState().plantsStatus === 'idle') loadPlants(); }, [flags.stocked, loadPlants]);
  const lakes = useMemo(() => filterLakes(), [q, county, sort, species, cat, size, flags, launches, origin, tags, index, plants]);
  const shown = useMemo(() => lakes.slice(0, LIST_CAP), [lakes]);

  const anyFilter = !!(q || county || species || cat || size || Object.values(flags).some(Boolean));
  const filterCount = [county, species, cat, size].filter(Boolean).length + Object.values(flags).filter(Boolean).length;

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
    setQ(''); setCounty(''); setSpecies(''); setCat(''); setSize('');
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
    if (isMobile()) useUI.getState().openSheet({ kind: 'lake', lake: l });
  }
  function open(e: MouseEvent, l: Lake) {
    e.stopPropagation();
    useUI.getState().openSheet({ kind: 'lake', lake: l });
  }
  function onRowKey(e: KeyboardEvent<HTMLDivElement>, l: Lake) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(l); }
  }

  const sol = useMemo(() => solunarSummary(new Date()), []);

  return (
    <>
      <InstallBanner />
      <div className="readout">
        <h2>Lakes</h2>
        <div className="rd">Bite window<b>{sol.majors[0]}</b></div>
      </div>
      <div className="controls" style={{ paddingTop: 6 }}>
        <input className="input" type="search" placeholder="Search lake or county" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" aria-label="Search lakes" />
        <div className="row filter-toggle">
          <button type="button" className={`btn sm${showFilters ? ' primary' : ''}`} onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}><Icon name="layers" size={14} />Filters{filterCount ? ` (${filterCount})` : ''}</button>
          <select className="select" value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="name">A to Z</option>
            <option value="acres">Largest first</option>
            <option value="dist" disabled={!origin}>Nearest first</option>
            <option value="catches">Most catches</option>
            <option value="visits">Most visits</option>
          </select>
        </div>
        {showFilters && (<>
        <div className="row">
          <select className="select" value={county} onChange={e => setCounty(e.target.value)} aria-label="County">
            <option value="">All counties</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={size} onChange={e => setSize(e.target.value as SizeKey)} aria-label="Size">
            <option value="">Any size</option>
            <option value="small">Small, under 25 ac</option>
            <option value="mid">25 to 200 ac</option>
            <option value="big">Big, 200 ac and up</option>
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
        <div className="legend">
        {CORE_LAKE_SPECIES.map(id => <span key={id}><i style={{ background: speciesColor(id) }} />{speciesLabel(id)}</span>)}
        <span><i style={{ background: 'transparent', boxShadow: '0 0 0 2px var(--amber)' }} />Favorite</span>
        <span><i style={{ background: 'transparent', boxShadow: '0 0 0 2px var(--water)' }} />Wish list</span>
        <span><i className="line" style={{ background: '#b5652f' }} />Trail to a lake (zoom in)</span>
      </div>
        </>)}
        <form className="row" onSubmit={e => { e.preventDefault(); findPlace(); }}>
          <button type="button" className="btn" onClick={nearMe} disabled={locating}><Icon name="locate" />Near me</button>
          <input
            className="input"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            placeholder="ZIP or place"
            value={place}
            onChange={e => setPlace(e.target.value)}
            autoComplete="off"
            aria-label="ZIP or place"
          />
          <button type="submit" className="btn primary" disabled={locating || !place.trim()} aria-label="Find place">{locating ? <span className="spinner" /> : 'Go'}</button>
        </form>
        {origin && (
          <div className="row">
            <span className="note" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Distances from {origin.label}</span>
            <button type="button" className="btn sm ghost" onClick={clearOrigin} aria-label="Clear origin"><Icon name="close" />Clear</button>
          </div>
        )}
      </div>


      <div className="meta">
        <span>{lakes.length} of {LAKES.length}{lakes.length > LIST_CAP ? `, first ${LIST_CAP} listed` : ''}{anyFilter && <> · <button type="button" className="btn sm ghost" style={{ padding: '0 4px', fontSize: 12 }} onClick={resetFilters}>Reset</button></>}</span>
        <small style={{ textAlign: 'right' }}>{launchStatus}</small>
      </div>

      <div className="list">
        {lakes.length === 0 && <Empty>No lakes match. Try clearing the filters.</Empty>}
        {shown.map(l => {
          const t = me ? tags[tagKey(me, l.slug)] : undefined;
          const st = index[l.slug];
          const launch = launches[l.slug];
          const color = pinColor(l);
          const ring = t?.fav ? 'var(--amber)' : t?.wish ? 'var(--water)' : null;
          let sub = lakeSub(l);
          if (launch) sub += ` · ${launch.type || 'ramp'}`; else if (l.ramp) sub += ' · ramp'; else if (l.kind === 'high') sub += ' · hike-in';
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
                {(() => { const d = origin ? haversine(origin.lat, origin.lng, l.lat, l.lng) : null; const fit = boatFit(l, launch); return (<><b>{d != null ? `${d < 10 ? d.toFixed(1) : Math.round(d)} mi` : l.acres ? `${Math.round(l.acres)} ac` : '-'}</b>{fit.label}{st && st.catches > 0 ? <><br />{st.catches} caught</> : null}</>); })()}
                <div className="desk-only" style={{ marginTop: 4 }}><button type="button" className="btn sm ghost" onClick={e => open(e, l)} aria-label={`Open ${l.name}`}>Open</button></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
