import { useEffect, useMemo, useState } from 'react';
import type { Coast } from '@/api/feeds';
import { fmtDate, lsGet, lsSet } from '@/lib/util';
import { useFeeds } from '@/store/feeds';
import { useUI } from '@/store/ui';
import { SEGMENTS, OPEN_STRIPS, driveStatus, segmentClosed, coastRules } from '@/domain/coast';
import { RuleCard, useFeedLoads } from '@/features/feeds/FeedBits';
import { Icon } from '@/components/ui';

const SEEN_KEY = 'wff-coast-seen';
const WDFW_LISTS = 'https://public.govdelivery.com/accounts/WADFW/subscriber/new';
const OS_ALERTS = 'https://portal.civicplus.com/WA-OceanShores/notifications?tab=alerts';

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(lsGet(SEEN_KEY) || '[]') as string[]); } catch { return new Set(); }
}

/** Every id the card shows, so the next visit can tell what is new. */
function idsOf(c: Coast | null, ruleIds: string[], driveKey: string): string[] {
  const out = [driveKey, ...ruleIds];
  if (!c) return out;
  if (c.razor.headline) out.push('razor:' + c.razor.headline + '|' + (c.razor.posted || ''));
  for (const n of c.news) out.push('news:' + n.id);
  if (c.oceanShores.alert) out.push('alert:' + c.oceanShores.alert.title + '|' + (c.oceanShores.alert.date || ''));
  for (const n of c.oceanShores.news) out.push('os:' + n.link);
  return out;
}

function New({ on }: { on: boolean }) { return on ? <span className="badge hot" style={{ marginLeft: 6 }}>New</span> : null; }

/**
 * Coast Watch: what changed on the North Beach coast. Beach driving dates from the WAC, emergency
 * rules for Marine Area 2 and Grays Harbor, the latest razor clam release, WDFW coast news, and
 * Ocean Shores city notices. Anything not seen on the last visit gets a New badge.
 */
export function CoastWatch() {
  useFeedLoads(['rules']);
  const coast = useFeeds(s => s.coast);
  const status = useFeeds(s => s.coastStatus);
  const loadCoast = useFeeds(s => s.loadCoast);
  const rules = useFeeds(s => s.rules);
  const rulesStatus = useFeeds(s => s.rulesStatus);
  const setTab = useUI(s => s.setTab);
  const [seen] = useState(readSeen);
  const [showAll, setShowAll] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showSegs, setShowSegs] = useState<boolean | null>(null);

  useEffect(() => { if (useFeeds.getState().coastStatus === 'idle') loadCoast(); }, [loadCoast]);

  const st = useMemo(() => driveStatus(), []);
  const driveKey = `drive:${st.closed ? 'closed' : 'open'}:${st.until.toISOString().slice(0, 10)}`;
  const cRules = useMemo(() => coastRules(rules).slice(0, 8), [rules]);
  const ids = useMemo(() => idsOf(coast, cRules.map(r => 'rule:' + r.id), driveKey), [coast, cRules, driveKey]);
  const isNew = (id: string) => seen.size > 0 && !seen.has(id);
  const newCount = ids.filter(isNew).length;

  // Remember what was on screen once the data is in, so the next visit only flags newer items.
  useEffect(() => {
    if (status !== 'ok' && status !== 'err') return;
    const merged = new Set([...seen, ...ids]);
    lsSet(SEEN_KEY, JSON.stringify(Array.from(merged).slice(-400)));
  }, [ids, status, seen]);

  const razor = coast?.razor;
  const cityNews = useMemo(() => {
    const list = coast?.oceanShores.news || [];
    const beach = list.filter(n => n.beach);
    const rest = list.filter(n => !n.beach);
    return showAll ? [...beach, ...rest] : beach.slice(0, 5);
  }, [coast, showAll]);
  const news = useMemo(() => {
    const list = coast?.news || [];
    return showAll ? list : list.filter(n => n.north).concat(list.filter(n => !n.north)).slice(0, 4);
  }, [coast, showAll]);

  return (
    <div className="section" style={{ marginTop: 8 }}>
      <div className="readout" style={{ padding: '0 0 6px' }}>
        <h2 style={{ fontSize: 22 }}>Coast Watch</h2>
        <div className="rd">{newCount ? 'Since your last look' : 'Ocean Shores to Moclips'}<b style={{ color: newCount ? 'var(--hot)' : 'var(--amber)' }}>{newCount ? `${newCount} new` : 'No changes'}</b></div>
      </div>

      {/* Beach driving */}
      <div className="stat" style={{ borderColor: st.closed ? 'rgba(255,90,79,.45)' : 'rgba(95,227,138,.4)' }}>
        <div className="l">Beach driving <New on={isNew(driveKey)} /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginTop: 4, color: st.closed ? 'var(--red)' : 'var(--green)' }}>{st.closed ? 'Seasonal segments closed' : 'Open to vehicles'}</div>
        <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{st.label} {st.daysLeft <= 14 && <b>{st.daysLeft} day{st.daysLeft === 1 ? '' : 's'}.</b>}</div>
        {!(showSegs ?? st.closed) && <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowSegs(true)}>Show the {SEGMENTS.length} segments</button>}
        {(showSegs ?? st.closed) && <div className="list" style={{ marginTop: 8 }}>
          {SEGMENTS.map(s => {
            const closed = segmentClosed(s, st);
            return (
              <div key={s.id} className="item" style={{ cursor: 'default', padding: '7px 10px' }}>
                <span className="pin" style={{ background: closed ? 'var(--red)' : 'var(--green)', height: 26 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{s.name}</div>
                  <div className="sub">{s.span}</div>
                </div>
                <span className={`badge ${closed ? 'hot' : 'ok'}`}>{closed ? (s.allYear ? 'All year' : 'Closed') : 'Open'}</span>
              </div>
            );
          })}
        </div>}
        <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowOpen(v => !v)}>{showOpen ? 'Hide' : 'Show'} the strips you can drive all year</button>
        {showOpen && (
          <div className="note" style={{ paddingTop: 6, lineHeight: 1.6 }}>
            {OPEN_STRIPS.map(s => <div key={s}>{s}</div>)}
            <div style={{ marginTop: 6 }}>25 mph, hard sand only, no ATVs, stay off the clam beds and the dunes. Approaches close on their own for storms and high tides; check the city alert below before you go. WAC 352-37-060.</div>
          </div>
        )}
      </div>

      {/* Emergency rules on the coast */}
      <h3 style={{ marginTop: 14 }}>Emergency rules <small>Marine Area 2, Grays Harbor</small></h3>
      {rulesStatus === 'loading' && !rules.length && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Loading WDFW rules</div>}
      {rulesStatus !== 'loading' && !cRules.length && <div className="note">No emergency rules naming the North Beach coast right now.</div>}
      {cRules.length > 0 && (
        <div className="list">
          {cRules.map(r => (
            <div key={r.id} style={{ position: 'relative' }}>
              {isNew('rule:' + r.id) && <span className="badge hot" style={{ position: 'absolute', top: -6, left: 10, zIndex: 1 }}>New</span>}
              <RuleCard r={r} compact />
            </div>
          ))}
        </div>
      )}

      {/* Razor clams */}
      <h3 style={{ marginTop: 14 }}>Razor clams <small>Copalis, Mocrocks</small></h3>
      {status === 'loading' && !coast && <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Loading coast feeds</div>}
      {status === 'err' && !coast && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="note">Could not reach the coast feeds. Check your signal and tap Refresh.</div>
          <button className="btn sm" onClick={() => loadCoast(true)}>Refresh</button>
        </div>
      )}
      {razor && (
        <a className="item" href={razor.url} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1fr', textDecoration: 'none' }}>
          <div style={{ minWidth: 0 }}>
            <div className="nm" style={{ fontSize: 14 }}>{razor.headline || 'Razor clam seasons and beaches'}<New on={isNew('razor:' + razor.headline + '|' + (razor.posted || ''))} /></div>
            {razor.posted && <div className="sub">WDFW, {razor.posted}</div>}
            {razor.window && <div className="sub" style={{ marginTop: 4, color: 'var(--ink)', whiteSpace: 'normal' }}>{razor.window}</div>}
            {razor.digs.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {razor.digs.map((d, i) => (
                  <div key={i} style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span className={`badge ${d.copalis ? 'ok' : 'water'}`} style={{ minWidth: 76, textAlign: 'center' }}>{d.copalis && d.mocrocks ? 'Both' : d.copalis ? 'Copalis' : 'Mocrocks'}</span>
                    <span style={{ whiteSpace: 'normal' }}>{d.text.replace(/;\s*Long Beach,?\s*Twin Harbors,?\s*/i, '; ').replace(/Long Beach, Twin Harbors, /i, '')}</span>
                  </div>
                ))}
              </div>
            )}
            {!razor.digs.length && <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{razor.allDigs ? 'No Copalis or Mocrocks dates in the latest release.' : 'No approved dig dates posted. WDFW posts tentative fall dates in early fall.'}</div>}
            {razor.notes.slice(0, showAll ? 8 : 2).map((n, i) => <div key={i} className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{n}</div>)}
          </div>
        </a>
      )}

      {/* WDFW coast news */}
      {news.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>WDFW coast news</h3>
          <div className="list">
            {news.map(n => (
              <a key={n.id} className="item" href={n.link} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{n.title}<New on={isNew('news:' + n.id)} /></div>
                  <div className="sub">{n.published ? fmtDate(n.published.slice(0, 10)) : ''}{n.north ? ' - North Beach' : ''}{n.razor ? ' - razor clams' : ''}</div>
                </div>
                <Icon name="external" size={16} />
              </a>
            ))}
          </div>
        </>
      )}

      {/* Ocean Shores city */}
      {coast && (coast.oceanShores.alert || cityNews.length > 0) && (
        <>
          <h3 style={{ marginTop: 14 }}>City of Ocean Shores</h3>
          <div className="list">
            {coast.oceanShores.alert && (
              <a className="item" href={coast.oceanShores.alert.link} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1fr', textDecoration: 'none', borderColor: 'rgba(255,138,31,.4)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 6 }}><span className="badge hot">Alert</span><div className="nm" style={{ fontSize: 13 }}>{coast.oceanShores.alert.title}<New on={isNew('alert:' + coast.oceanShores.alert.title + '|' + (coast.oceanShores.alert.date || ''))} /></div></div>
                  <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{coast.oceanShores.alert.text.slice(0, 220)}{coast.oceanShores.alert.text.length > 220 ? '...' : ''}</div>
                </div>
              </a>
            )}
            {cityNews.map(n => (
              <a key={n.link} className="item" href={n.link} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{n.title}<New on={isNew('os:' + n.link)} /></div>
                  <div className="sub">{n.date || ''}{n.beach ? ' - beach, access, or closure' : ''}</div>
                </div>
                <Icon name="external" size={16} />
              </a>
            ))}
          </div>
        </>
      )}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn sm ghost" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show less' : 'Show everything'}</button>
        <button type="button" className="btn sm ghost" onClick={() => loadCoast(true)} disabled={status === 'loading'}><Icon name="refresh" size={14} />Refresh</button>
      </div>
      <div className="note" style={{ paddingTop: 8, lineHeight: 1.6 }}>
        Get alerts on your phone: <button type="button" className="linkbtn" onClick={() => setTab('more')}>turn on Coast alerts under More</button>. WDFW also emails razor clam and rule updates: <a href={WDFW_LISTS} target="_blank" rel="noopener">WDFW email lists</a>. The city posts beach approach closures at <a href={OS_ALERTS} target="_blank" rel="noopener">Ocean Shores alerts</a>.
        {coast?.fetched && <span> Checked {new Date(coast.fetched).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</span>}
      </div>
    </div>
  );
}
