import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Lake, Forecast, LakeTag, DailyForecast } from '@/lib/types';
import { haversine, acreFmt, scoreColor } from '@/lib/util';
import { tagKey } from '@/lib/db';
import { LAKES } from '@/data/lakes';
import { useData, currentUserId, type LogStats } from '@/store/data';
import { useUI } from '@/store/ui';
import { multiForecast, sunWind } from '@/api/openMeteo';
import { fetchNoaaTides, fetchModelTides, SURF_SITE, type Tide } from '@/api/tides';
import { dayScore, whyText, solunarSummary } from '@/domain/scoring';
import { tideWindows, surfScore, dayIdx, type TideWindow, type SurfScore } from '@/domain/surf';
import { pairSuggestions } from '@/domain/journal';
import { Score, Empty } from '@/components/ui';

type Mode = 'lakes' | 'surf';

const EMPTY_STATS: LogStats = { visits: 0, catches: 0, sp: {}, top: null, lastDate: null };

export function PlanPanel() {
  const [mode, setMode] = useState<Mode>('lakes');
  return (
    <div>
      <div style={{ padding: '12px 0 4px' }}>
        <div className="modebar" style={{ boxShadow: 'none' }} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'lakes'} className={mode === 'lakes' ? 'on' : ''} onClick={() => setMode('lakes')}>Lakes</button>
          <button type="button" role="tab" aria-selected={mode === 'surf'} className={mode === 'surf' ? 'on' : ''} onClick={() => setMode('surf')}>Surf</button>
        </div>
      </div>
      {mode === 'lakes' ? <LakesPlan /> : <SurfPlan />}
    </div>
  );
}

/* ---------------- Lakes ---------------- */

function planCandidates(tags: Record<string, LakeTag>, me: string | null, origin: { lat: number; lng: number } | null): Lake[] {
  const set: Lake[] = []; const seen: Record<number, boolean> = {};
  if (me) {
    for (const l of LAKES) { const m = tags[tagKey(me, l.slug)]; if (m && (m.fav || m.wish)) { set.push(l); seen[l.id] = true; } }
  }
  const dist = (l: Lake) => origin ? haversine(origin.lat, origin.lng, l.lat, l.lng) : 1e9;
  const rest = LAKES.slice().sort((a, b) => origin ? dist(a) - dist(b) : (b.acres || 0) - (a.acres || 0));
  for (const l of rest) { if (set.length >= 24) break; if (!seen[l.id]) { set.push(l); seen[l.id] = true; } }
  return set.slice(0, 24);
}

function dayLabel(t: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return new Date(t + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

function LakesPlan() {
  const tags = useData(s => s.tags);
  const index = useData(s => s.index);
  const origin = useUI(s => s.origin);
  const setActiveLake = useUI(s => s.setActiveLake);
  const setMobileView = useUI(s => s.setMobileView);
  const openSheet = useUI(s => s.openSheet);
  const me = currentUserId();

  const lakes = useMemo(() => planCandidates(tags, me, origin), [tags, me, origin]);
  const key = useMemo(() => lakes.map(l => l.slug).join('|'), [lakes]);

  const [fc, setFc] = useState<Forecast[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [day, setDay] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState('loading');
    multiForecast(lakes, ac.signal)
      .then(r => { if (ac.signal.aborted) return; setFc(r); setState('ok'); })
      .catch(() => { if (ac.signal.aborted) return; setState('err'); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const daily: DailyForecast | null = fc?.[0]?.daily ?? null;
  const days = daily?.time ?? [];
  const safeDay = Math.min(day, Math.max(0, days.length - 1));

  const rows = useMemo(() => {
    if (!fc) return [];
    return lakes.map((l, i) => ({ l, s: dayScore(fc[i], safeDay) }))
      .filter((r): r is { l: Lake; s: NonNullable<ReturnType<typeof dayScore>> } => !!r.s)
      .sort((a, b) => b.s.score - a.s.score);
  }, [fc, lakes, safeDay]);

  const sol = useMemo(() => days[safeDay] ? solunarSummary(new Date(days[safeDay] + 'T12:00:00')) : null, [days, safeDay]);

  const statsFn = (l: Lake): LogStats => index[l.slug] || EMPTY_STATS;
  const tagFn = (l: Lake): LakeTag | undefined => me ? tags[tagKey(me, l.slug)] : undefined;
  const pairs = useMemo(() => pairSuggestions(LAKES, statsFn, tagFn), [index, tags, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (l: Lake) => { setActiveLake(l.id); setMobileView('map'); };

  return (
    <div>
      <div className="section" style={{ marginTop: 8 }}>
        <h3>Bite forecast <small>{origin ? `near ${origin.label}` : 'largest lakes'}</small></h3>
        {state === 'loading' && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Loading 7-day forecast</div>}
        {state === 'err' && (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="note">Could not load the forecast. Check your signal and tap Refresh.</div>
            <button className="btn sm" onClick={() => setNonce(n => n + 1)}>Refresh</button>
          </div>
        )}
        {state === 'ok' && (
          <>
            <div className="dayrow">
              {days.map((t, i) => <button key={t} type="button" className={`day${i === safeDay ? ' active' : ''}`} onClick={() => setDay(i)}>{dayLabel(t, i)}</button>)}
            </div>
            {sol && <div className="note" style={{ padding: '2px 0 8px' }}>Major bite near <b>{sol.majors[0]}</b> and <b>{sol.majors[1]}</b>. Minor near {sol.minors[0]} and {sol.minors[1]}. Moon {sol.illum}% lit. Estimates, local time.</div>}
            <div className="note" style={{ paddingBottom: 8 }}>Guide from wind, sky, rain, temperature, and moon. Tap a lake to show it on the map.</div>
            {!rows.length && <Empty>No forecast data.</Empty>}
            <div className="list">
              {rows.map(r => {
                const x = r.s;
                const meta = [x.t != null ? `${Math.round(x.t)}°` : null, x.w != null ? `${Math.round(x.w)} mph` : null, x.p != null ? `${x.p}% rain` : null].filter(Boolean).join(' · ');
                return (
                  <div key={r.l.id} className="prow" onClick={() => open(r.l)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') open(r.l); }}>
                    <Score n={x.score} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pname">{r.l.name}</div>
                        <div className="pwhy">{whyText(x)}</div>
                        <div className="pmeta">{meta}</div>
                      </div>
                      <button type="button" className="btn sm ghost" onClick={e => { e.stopPropagation(); openSheet({ kind: 'lake', lake: r.l }); }}>Open</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h3>Pair a proven lake with a scout</h3>
        <div className="note" style={{ paddingBottom: 8 }}>One proven lake plus one scouting stop nearby. Tap either lake to show it on the map.</div>
        {!pairs.length && <Empty>Log catches or flag Want to visit lakes and pairs appear here.</Empty>}
        <div className="list">
          {pairs.map(x => {
            const ps = statsFn(x.p);
            return (
              <div key={`${x.p.id}-${x.s.id}`} style={pairStyle}>
                <button type="button" style={legStyle} onClick={() => open(x.p)}>
                  <span className="badge ok">Proven</span>
                  <div className="pname" style={{ marginTop: 4 }}>{x.p.name}</div>
                  <div className="pmeta">{ps.catches} catches · {ps.visits} visits</div>
                </button>
                <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.d.toFixed(0)} mi</div>
                <button type="button" style={legStyle} onClick={() => open(x.s)}>
                  <span className="badge warn">Scout</span>
                  <div className="pname" style={{ marginTop: 4 }}>{x.s.name}</div>
                  <div className="pmeta">{x.why} · {acreFmt(x.s.acres)} ac</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const pairStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', padding: 8 };
const legStyle: CSSProperties = { textAlign: 'left', minWidth: 0, padding: 4, borderRadius: 6, cursor: 'pointer' };

/* ---------------- Surf ---------------- */

interface SurfData { tides: Tide[]; wx: DailyForecast | null; source: 'noaa' | 'model'; }
interface Scored { w: TideWindow; s: SurfScore; }

function surfT(d: Date): string { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function isWeekend(d: Date): boolean { const g = d.getDay(); return g === 0 || g === 6; }

async function loadSurf(): Promise<SurfData> {
  const wp = sunWind(SURF_SITE.lat, SURF_SITE.lng, 10);
  let tides: Tide[]; let source: SurfData['source'] = 'noaa';
  try { tides = await fetchNoaaTides(); }
  catch (e1) {
    try { tides = await fetchModelTides(); source = 'model'; }
    catch (e2) { throw new Error(`${(e1 as Error)?.message || 'NOAA failed'}, ${(e2 as Error)?.message || 'backup failed'}`); }
  }
  const wx = await wp;
  return { tides, wx, source };
}

function SurfPlan() {
  const [data, setData] = useState<SurfData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setBusy(true); setErr('');
    loadSurf()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) { setData(null); setErr(String((e as Error)?.message || e)); } })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [nonce]);

  const scored = useMemo<Scored[]>(() => {
    if (!data) return [];
    return tideWindows(data.tides).map(w => ({ w, s: surfScore(w, data.wx, dayIdx(w.hi.t)) }));
  }, [data]);

  const byScore = useMemo(() => scored.slice().sort((a, b) => b.s.score - a.s.score), [scored]);
  const top = byScore[0];
  const wkTop = byScore.find(x => isWeekend(x.w.hi.t));
  const showWk = top && wkTop && wkTop !== top && !isWeekend(top.w.hi.t);

  const groups = useMemo(() => {
    const map = new Map<string, Scored[]>();
    for (const x of scored) { const k = x.w.hi.t.toDateString(); const arr = map.get(k); if (arr) arr.push(x); else map.set(k, [x]); }
    return Array.from(map.entries());
  }, [scored]);

  return (
    <div>
      <div className="section" style={{ marginTop: 8 }}>
        <h3>Surf perch <small>{SURF_SITE.name}</small></h3>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8 }}>
          <div className="note">NOAA tides at Point Brown (station {SURF_SITE.station}), the Copalis reference. Incoming water only. The deeper the low tide drops, the better the push behind it. Prime is the last two hours into high slack.</div>
          <button className="btn sm" onClick={() => setNonce(n => n + 1)} disabled={busy}>Refresh</button>
        </div>
        {busy && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Loading NOAA tides</div>}
        {!busy && err && <Empty>Tide feeds unavailable ({err}). Tap Refresh.</Empty>}
        {!busy && data && !scored.length && <Empty>No incoming windows in range.</Empty>}
        {!busy && data && top && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.source === 'model' && <div className="note">NOAA station feed unreachable, showing backup tide model. Times close, heights approximate.</div>}
            <Hero label={`Best shot ahead${isWeekend(top.w.hi.t) ? ', weekend' : ''}`} x={top} />
            {showWk && wkTop && <Hero label="Best weekend window" x={wkTop} amber />}
          </div>
        )}
      </div>

      {!busy && data && groups.length > 0 && (
        <div className="section">
          <h3>Incoming windows</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map(([k, list]) => {
              const d = new Date(k); const idx = dayIdx(d); const wk = isWeekend(d);
              const sr = data.wx?.sunrise?.[idx], ss = data.wx?.sunset?.[idx];
              return (
                <div key={k}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 6px', fontWeight: 600, fontSize: 13.5 }}>
                    <span>{d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    {wk && <span className="badge warn">weekend</span>}
                    {sr && ss && <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 12, marginLeft: 'auto' }}>light {surfT(new Date(sr))} to {surfT(new Date(ss))}</span>}
                  </div>
                  <div className="list">
                    {list.map((x, i) => {
                      const arrive = new Date(x.s.primeStart.getTime() - 30 * 60e3);
                      return (
                        <div key={i} className="prow" style={{ cursor: 'default' }}>
                          <Score n={x.s.score} />
                          <div style={{ minWidth: 0 }}>
                            <div className="pname">{surfT(x.w.lo.t)} low {'->'} {surfT(x.w.hi.t)} high</div>
                            <div className="pwhy">Arrive <b>{surfT(arrive)}</b> · lines in {surfT(x.s.primeStart)} · fish to {surfT(x.w.hi.t)} slack</div>
                            <div className="pmeta">Low {x.w.lo.v.toFixed(1)} ft · High {x.w.hi.v.toFixed(1)} ft{x.s.tags.length ? ' · ' + x.s.tags.join(' · ') : ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Hero({ label, x, amber }: { label: string; x: Scored; amber?: boolean }) {
  const d = x.w.hi.t; const arrive = new Date(x.s.primeStart.getTime() - 30 * 60e3);
  return (
    <div className="stat" style={amber ? { borderColor: 'rgba(234,162,76,.45)' } : undefined}>
      <div className="l" style={amber ? { color: 'var(--amber)' } : undefined}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginTop: 4 }}>
        {d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} · <span style={{ color: scoreColor(x.s.score) }}>{x.s.score}</span>
      </div>
      <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>
        Arrive by <b>{surfT(arrive)}</b>, lines in at <b>{surfT(x.s.primeStart)}</b>, fish the push to the <b>{surfT(d)}</b> high slack. Low {x.w.lo.v.toFixed(1)} ft at {surfT(x.w.lo.t)}, {(x.w.hi.v - x.w.lo.v).toFixed(1)} ft of swing to a {x.w.hi.v.toFixed(1)} ft high.
      </div>
    </div>
  );
}
