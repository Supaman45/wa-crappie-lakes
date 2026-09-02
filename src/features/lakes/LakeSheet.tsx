import { useEffect, useMemo, useState } from 'react';
import type { Lake, Forecast, Catch } from '@/lib/types';
import { CATS, SWATCHES, speciesColor, speciesLabel } from '@/data/species';
import { tagKey } from '@/lib/db';
import { toast } from '@/lib/toast';
import { fmtDate, dirUrl, wdfwLakeUrl, haversine } from '@/lib/util';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { useLakes } from '@/features/lakes/store';
import { lakeSub } from '@/domain/journal';
import { dayScore, whyText, solunarSummary } from '@/domain/scoring';
import { lakeForecast } from '@/api/openMeteo';
import { Sheet, Icon, Score } from '@/components/ui';
import { useFeeds } from '@/store/feeds';
import { rulesFor, plantsFor } from '@/api/feeds';
import { useFeedLoads, RulesList, PlantRow } from '@/features/feeds/FeedBits';

type FcState = { status: 'loading' } | { status: 'ok'; fc: Forecast } | { status: 'err' };

function isMobile(): boolean { return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches; }

function dayLabel(t: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  const d = new Date(t + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function LakeSheet({ lake }: { lake: Lake }) {
  const closeSheet = useUI(s => s.closeSheet);
  const openSheet = useUI(s => s.openSheet);
  const setActiveLake = useUI(s => s.setActiveLake);
  const origin = useUI(s => s.origin);

  const tags = useData(s => s.tags);
  const profiles = useData(s => s.profiles);
  const catches = useData(s => s.catches);
  const index = useData(s => s.index);
  const setTag = useData(s => s.setTag);
  const logVisit = useData(s => s.logVisit);

  const launch = useLakes(s => s.launches[lake.slug]);

  const me = currentUserId();
  const mine = me ? tags[tagKey(me, lake.slug)] : undefined;
  const st = index[lake.slug];

  const crew = useMemo(() => useData.getState().crewTags(lake.slug), [tags, lake.slug]);
  const recent = useMemo<Catch[]>(
    () => catches.filter(c => c.lake_id === lake.slug).slice().sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [catches, lake.slug],
  );
  const sol = useMemo(() => solunarSummary(new Date()), []);

  useFeedLoads(['rules', 'plants']);
  const rules = useFeeds(s => s.rules);
  const rulesStatus = useFeeds(s => s.rulesStatus);
  const plants = useFeeds(s => s.plants);
  const plantsStatus = useFeeds(s => s.plantsStatus);
  const myRules = useMemo(() => rulesFor(rules, lake.name, lake.counties), [rules, lake.name, lake.counties]);
  const myPlants = useMemo(() => plantsFor(plants, lake.name, lake.counties).slice(0, 6), [plants, lake.name, lake.counties]);

  const [fc, setFc] = useState<FcState>({ status: 'loading' });
  useEffect(() => {
    const ac = new AbortController();
    setFc({ status: 'loading' });
    lakeForecast(lake.lat, lake.lng, ac.signal)
      .then(f => { if (!ac.signal.aborted) setFc(f?.daily?.time?.length ? { status: 'ok', fc: f } : { status: 'err' }); })
      .catch(() => { if (!ac.signal.aborted) setFc({ status: 'err' }); });
    return () => ac.abort();
  }, [lake.lat, lake.lng]);

  const distFromOrigin = origin ? haversine(origin.lat, origin.lng, lake.lat, lake.lng) : null;
  const launchDist = launch ? (launch.dist ?? haversine(lake.lat, lake.lng, launch.lat, launch.lng)) : null;
  const dest = launch ? { lat: launch.lat, lng: launch.lng } : { lat: lake.lat, lng: lake.lng };

  async function onLogVisit() {
    const ok = await logVisit(lake.slug, lake.name, 'lake');
    toast(ok ? 'Visit logged' : 'Already logged today', ok ? 'info' : 'warn');
  }
  function onLogCatch() { openSheet({ kind: 'catch', lakeId: lake.slug, lakeName: lake.name, waterType: 'lake' }); }
  function onShowMap() {
    closeSheet();
    setActiveLake(lake.id);
    if (isMobile()) useUI.getState().setMobileView('map');
  }

  const footer = (
    <>
      <button type="button" className="btn" onClick={onLogVisit}><Icon name="check" />Log visit</button>
      <button type="button" className="btn primary" onClick={onLogCatch}><Icon name="plus" />Log catch</button>
      <a className="btn" href={dirUrl(dest.lat, dest.lng)} target="_blank" rel="noopener noreferrer"><Icon name="nav" />Directions</a>
      <a className="btn ghost" href={wdfwLakeUrl(lake.slug)} target="_blank" rel="noopener noreferrer"><Icon name="external" />WDFW page</a>
      <button type="button" className="btn ghost" onClick={onShowMap}><Icon name="pin" />Show on map</button>
    </>
  );

  return (
    <Sheet title={lake.name} sub={lakeSub(lake) + (distFromOrigin != null ? ` · ${distFromOrigin.toFixed(1)} mi from ${origin?.label}` : '')} onClose={closeSheet} footer={footer}>
      <div className="pill-row">
        {lake.sp.map(id => <span key={id} className="badge" style={{ color: speciesColor(id) }}>{speciesLabel(id)}</span>)}
        {lake.sp.length === 0 && <span className="badge">No species listed</span>}
      </div>

      <div className="section">
        <h3>Boat launch</h3>
        {launch ? (
          <div className="kv">
            <span className="k">Name</span><span className="v">{launch.name}</span>
            <span className="k">Type</span><span className="v">{launch.type || 'n/a'}</span>
            <span className="k">Motors</span><span className="v">{launch.motor ? 'OK' : 'No'}</span>
            <span className="k">ADA</span><span className="v">{launch.ada ? 'Yes' : 'No'}</span>
            {launch.hp && <><span className="k">HP limit</span><span className="v">{launch.hp}</span></>}
            {launchDist != null && <><span className="k">From lake center</span><span className="v">{launchDist.toFixed(1)} mi</span></>}
          </div>
        ) : (
          <div className="note">No WDFW boat launch matched nearby. May be shore access only. The WDFW page lists details.</div>
        )}
      </div>

      {(myRules.length > 0 || rulesStatus === 'loading') && (
        <div className="section">
          <h3>Emergency rules <small>{myRules.length ? `${myRules.length} match` : 'checking'}</small></h3>
          <RulesList rules={myRules} empty="Checking WDFW emergency rules" />
        </div>
      )}

      <div className="section">
        <h3>Trout plants <small>{plantsStatus === 'ok' ? (myPlants.length ? 'recent' : 'none recent') : plantsStatus === 'loading' ? 'loading' : ''}</small></h3>
        {myPlants.length > 0 && <div className="list">{myPlants.map((p, i) => <PlantRow key={i} p={p} />)}</div>}
        {myPlants.length === 0 && <div className="note">{plantsStatus === 'err' ? 'Could not load the WDFW stocking report.' : plantsStatus === 'loading' ? 'Loading the WDFW stocking report' : 'No trout plant listed for this lake in the recent WDFW report.'}</div>}
      </div>

      <div className="section">
        <h3>My tags</h3>
        <div className="pill-row" style={{ marginBottom: 8 }}>
          <button type="button" className={`btn sm${mine?.fav ? ' amber' : ''}`} aria-pressed={!!mine?.fav} onClick={() => setTag(lake.slug, { fav: !mine?.fav })}><Icon name="star" />{mine?.fav ? 'Favorite' : 'Favorite'}</button>
          <button type="button" className={`btn sm${mine?.wish ? ' primary' : ''}`} aria-pressed={!!mine?.wish} onClick={() => setTag(lake.slug, { wish: !mine?.wish })}><Icon name="heart" />{mine?.wish ? 'On wish list' : 'Wish list'}</button>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <select className="select" value={mine?.cat || ''} onChange={e => setTag(lake.slug, { cat: e.target.value || null })} aria-label="Category">
            <option value="">No category</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="pill-row" role="group" aria-label="Pin color">
          {SWATCHES.map(c => {
            const on = mine?.color === c;
            return (
              <button
                key={c}
                type="button"
                aria-label={on ? 'Clear pin color' : 'Set pin color'}
                aria-pressed={on}
                onClick={() => setTag(lake.slug, { color: on ? null : c })}
                style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: on ? '3px solid var(--ink)' : '2px solid transparent', boxShadow: on ? '0 0 0 2px ' + c : undefined }}
              />
            );
          })}
        </div>
      </div>

      <div className="section">
        <h3>Crew <small>{crew.length ? `${crew.length} tagged` : ''}</small></h3>
        {crew.length === 0 && <div className="note">Nobody else in the crew has tagged this lake.</div>}
        {crew.length > 0 && (
          <div className="pill-row">
            {crew.map(t => {
              const p = profiles[t.user_id];
              const what = [t.fav ? 'favorite' : null, t.wish ? 'wish list' : null, t.cat].filter(Boolean).join(', ');
              return <span key={t.user_id} className="profile-pill"><i style={{ background: p?.color || '#8fa79e' }} />{p?.name || 'Angler'}<span style={{ color: 'var(--muted)', fontWeight: 500 }}>{what}</span></span>;
            })}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Log</h3>
        <div className="kv">
          <span className="k">Visits</span><span className="v">{st?.visits || 0}</span>
          <span className="k">Catches</span><span className="v">{st?.catches || 0}</span>
          <span className="k">Top species</span><span className="v">{st?.top ? speciesLabel(st.top) : 'none'}</span>
          <span className="k">Last</span><span className="v">{st?.lastDate ? fmtDate(st.lastDate) : 'never'}</span>
        </div>
        {recent.length > 0 && (
          <div className="list" style={{ marginTop: 10 }}>
            {recent.map(c => (
              <div key={c.id} className="jcard" role="button" tabIndex={0} onClick={() => openSheet({ kind: 'catchView', catchId: c.id })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet({ kind: 'catchView', catchId: c.id }); } }}>
                <div>
                  <div className="who"><i style={{ background: profiles[c.user_id]?.color || '#8fa79e' }} />{profiles[c.user_id]?.name || 'Angler'}</div>
                  <div className="t">{c.qty > 1 ? `${c.qty} ` : ''}{speciesLabel(c.species)}{c.length != null ? `, ${c.length}"` : ''}</div>
                </div>
                <div className="d">{fmtDate(c.date)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3>3-day bite forecast</h3>
        {fc.status === 'loading' && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" />Loading forecast</div>}
        {fc.status === 'err' && <div className="note">Forecast unavailable right now. Check the connection and reopen the lake.</div>}
        {fc.status === 'ok' && (
          <div className="list">
            {fc.fc.daily.time.slice(0, 3).map((t, i) => {
              const x = dayScore(fc.fc, i);
              if (!x) return null;
              const bits = [x.t != null ? `${Math.round(x.t)}°` : null, x.w != null ? `${Math.round(x.w)} mph wind` : null, x.p != null ? `${Math.round(x.p)}% rain` : null].filter(Boolean).join(' · ');
              return (
                <div key={t} className="prow" style={{ cursor: 'default' }}>
                  <Score n={x.score} />
                  <div style={{ minWidth: 0 }}>
                    <div className="pname">{dayLabel(t, i)}</div>
                    <div className="pwhy">{whyText(x)}</div>
                    <div className="pmeta">{bits}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section">
        <h3>Solunar today <small>{sol.illum}% moon</small></h3>
        <div className="kv">
          <span className="k">Major periods</span><span className="v">{sol.majors.join(', ')}</span>
          <span className="k">Minor periods</span><span className="v">{sol.minors.join(', ')}</span>
        </div>
      </div>
    </Sheet>
  );
}
