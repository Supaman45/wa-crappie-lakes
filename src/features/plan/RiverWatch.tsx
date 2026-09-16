import { useEffect, useMemo, useState } from 'react';
import { lsGet, lsSet, dirUrl } from '@/lib/util';
import { useFeeds } from '@/store/feeds';
import { rulesFor } from '@/api/feeds';
import {
  WATCH_RIVERS, type WatchRiver, type Section,
  sportOn, netState, outlook, nextClearDay, clearAlternative, fmtWindow, localDate, newFilings,
} from '@/domain/river';
import { RulesList, useFeedLoads } from '@/features/feeds/FeedBits';
import { Icon } from '@/components/ui';

const SECTION_KEY = 'wff-river-section';
const SEEN_KEY = 'wff-river-seen';

function readSeen(): Set<string> {
  try { return new Set(JSON.parse(lsGet(SEEN_KEY) || '[]') as string[]); } catch { return new Set(); }
}

function dayLabel(d: Date, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function shortDay(d: Date): string { return d.toLocaleDateString(undefined, { weekday: 'narrow' }); }

const VERDICT = {
  go: { cls: 'ok', dot: 'var(--green)', word: 'Open' },
  nets: { cls: 'warn', dot: 'var(--amber)', word: 'Nets in' },
  closed: { cls: 'hot', dot: 'var(--red)', word: 'Closed' },
} as const;

/**
 * River Watch: on a river shared with a treaty tribe, the days you may fish and the days the nets
 * are in the water are two calendars. This card merges them for the section you actually fish and
 * says plainly what today is.
 */
export function RiverWatch({ riverId = 'puyallup' }: { riverId?: string }) {
  useFeedLoads(['rules']);
  const river = WATCH_RIVERS.find(r => r.id === riverId) || WATCH_RIVERS[0];
  const rules = useFeeds(s => s.rules);
  const feed = useFeeds(s => s.river);
  const status = useFeeds(s => s.riverStatus);
  const loadRiver = useFeeds(s => s.loadRiver);
  const [seen] = useState(readSeen);
  const [showDays, setShowDays] = useState(false);

  const [secId, setSecId] = useState(() => lsGet(SECTION_KEY) || river.sections[0].id);
  const sec: Section = river.sections.find(s => s.id === secId) || river.sections[0];

  useEffect(() => { if (useFeeds.getState().riverStatus === 'idle') loadRiver(); }, [loadRiver]);

  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => sportOn(sec, now), [sec, now]);
  const nets = useMemo(() => netState(river, now), [river, now]);
  const rows = useMemo(() => outlook(river, sec, now, 10), [river, sec, now]);
  const clear = useMemo(() => nextClearDay(river, sec, now), [river, sec, now]);
  const alt = useMemo(() => clearAlternative(river, now, sec.id), [river, sec, now]);
  const rRules = useMemo(() => rulesFor(rules, river.name, river.counties), [rules, river]);

  // Filings the shipped windows were not read from. A new one means the schedule may have moved.
  const fresh = useMemo(() => newFilings(river, feed?.filings || []), [feed, river]);
  const unseen = fresh.filter(f => seen.size === 0 || !seen.has(f.file));

  useEffect(() => {
    if (status !== 'ok') return;
    const merged = new Set([...seen, ...fresh.map(f => f.file)]);
    lsSet(SEEN_KEY, JSON.stringify(Array.from(merged).slice(-200)));
  }, [fresh, status, seen]);

  const netsHere = sec.netted && nets.inNow;
  const stale = nets.stale && sec.netted;
  const verdict = !today.open ? 'closed' : netsHere ? 'nets' : 'go';
  const v = VERDICT[verdict];

  const headline = !today.open
    ? 'Closed to you today'
    : netsHere ? 'Open, but nets are in your water'
      : stale ? 'Open to you. Net schedule unknown.'
        : 'Open, and the nets are out';

  const detail = stale && today.open
    ? 'Every net window this app ships has already run. The tribe refiles each season, so open the filings page before you count on clear water.'
    : !today.open
    ? (clear ? `${today.why}. Next open day is ${dayLabel(clear.date, rows.indexOf(clear))}.` : today.why)
    : netsHere && nets.current
      ? `Nets come out ${fmtWindow(nets.current).split(' to ')[1]}.${alt ? ` No nets above the White River confluence, so ${alt.name} is clear.` : ''}`
      : nets.next
        ? `${today.why}. Next net window opens ${fmtWindow(nets.next).split(' to ')[0]}.`
        : today.why;

  return (
    <div className="section" style={{ marginTop: 8 }}>
      <div className="readout" style={{ padding: '0 0 6px' }}>
        <h2 style={{ fontSize: 22 }}>River Watch</h2>
        <div className="rd">{river.name}<b style={{ color: unseen.length ? 'var(--hot)' : 'var(--amber)' }}>{unseen.length ? `${unseen.length} new filing${unseen.length === 1 ? '' : 's'}` : `Shared with the ${river.tribe.replace(' of Indians', '')}`}</b></div>
      </div>

      {/* Today */}
      <div className="stat" style={{ borderColor: verdict === 'go' ? 'rgba(95,227,138,.4)' : verdict === 'nets' ? 'rgba(234,162,76,.45)' : 'rgba(255,90,79,.45)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="l">Today</div>
          <select value={secId} onChange={e => { setSecId(e.target.value); lsSet(SECTION_KEY, e.target.value); }} style={{ fontSize: 12, padding: '4px 6px', minHeight: 30, maxWidth: '62%' }} aria-label="River section">
            {river.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginTop: 4, color: v.dot }}>{headline}</div>
        <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{detail}</div>
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
          <span className={`badge ${sec.netted ? 'warn' : 'ok'}`}>{sec.netted ? 'Nets set here' : 'No nets here'}</span>
          {nets.current && <span className="badge hot">Nets in until {fmtWindow(nets.current).split(' to ')[1]}</span>}
          {!nets.current && nets.next && <span className="badge water">Next nets {fmtWindow(nets.next).split(' to ')[0]}</span>}
          {!nets.current && !nets.next && nets.pending && <span className="badge">Coho filing done</span>}
          {nets.stale && <span className="badge hot">Schedule out of date</span>}
        </div>
        {sec.note && <div className="note" style={{ paddingTop: 6 }}>{sec.note}</div>}
      </div>

      {/* Ten day strip */}
      <div className="dayrow" style={{ marginTop: 10 }}>
        {rows.map((r, i) => {
          const x = VERDICT[r.verdict];
          return (
            <button key={i} type="button" className="day" onClick={() => setShowDays(true)} title={`${dayLabel(r.date, i)} - ${x.word}`} style={{ borderColor: i === 0 ? x.dot : undefined }}>
              <span style={{ display: 'block', fontSize: 10, opacity: .7 }}>{shortDay(r.date)}</span>
              <span style={{ display: 'block', fontWeight: 700 }}>{r.date.getDate()}</span>
              <span style={{ display: 'block', width: 6, height: 6, borderRadius: 3, background: x.dot, margin: '3px auto 0' }} />
            </button>
          );
        })}
      </div>
      {!showDays && <button type="button" className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setShowDays(true)}>Show the next 10 days</button>}
      {showDays && (
        <div className="list" style={{ marginTop: 8 }}>
          {rows.map((r, i) => {
            const x = VERDICT[r.verdict];
            return (
              <div key={i} className="item" style={{ cursor: 'default', padding: '7px 10px' }}>
                <span className="pin" style={{ background: x.dot, height: 26 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{dayLabel(r.date, i)}</div>
                  <div className="sub">{r.verdict === 'closed' ? `${r.why}${r.net ? `. ${r.net.species} nets in.` : ''}` : r.net ? `${r.net.species} nets until ${fmtWindow(r.net).split(' to ')[1]}` : 'Clear water, no nets'}</div>
                </div>
                <span className={`badge ${x.cls}`}>{x.word}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* New filing */}
      {fresh.length > 0 && (
        <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10, borderColor: 'rgba(255,90,79,.4)' }}>
          <div style={{ minWidth: 0 }}>
            <div className="nm" style={{ fontSize: 13 }}>New filings on the tribe's page {unseen.length > 0 && <span className="badge hot" style={{ marginLeft: 6 }}>New</span>}</div>
            <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>The dates above were read from filing {river.nets[0]?.filingNo}. These went up after that, so the schedule may have changed. Open them and check.</div>
            {fresh.slice(0, 4).map(f => (
              <a key={f.file} className="btn sm" href={f.url} target="_blank" rel="noopener" style={{ marginTop: 6, textDecoration: 'none', display: 'inline-flex' }}>
                <Icon name="external" size={14} />{f.title}{f.posted ? ` (${f.posted})` : ''}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Where the nets go, and what else is running */}
      <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="nm" style={{ fontSize: 13 }}>Where the nets are set</div>
          <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{river.netArea}. Drift nets to 210 ft, set nets to 60 ft. Nothing above that confluence.</div>
          {river.sideNotes.map((n, i) => <div key={i} className="sub" style={{ marginTop: 6, whiteSpace: 'normal' }}>{n}</div>)}
          {nets.pending && <div className="sub" style={{ marginTop: 6, whiteSpace: 'normal' }}><span className="badge warn" style={{ marginRight: 6 }}>Ahead</span>{nets.pending.label}</div>}
        </div>
      </div>

      {/* Limits */}
      <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="nm" style={{ fontSize: 13 }}>Limits and gear</div>
          {river.limits.map((l, i) => <div key={i} className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{l}</div>)}
        </div>
      </div>

      {/* Emergency rules */}
      <div className="section" style={{ marginTop: 12 }}>
        <h3>Emergency rules <small>{rRules.length ? `${rRules.length} match` : 'none match'}</small></h3>
        <RulesList rules={rRules.slice(0, 6)} compact empty="No emergency rule names this river right now, so the permanent rule stands." />
      </div>

      <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {sec.lat != null && sec.lng != null && <a className="btn" href={dirUrl(sec.lat, sec.lng)} target="_blank" rel="noopener"><Icon name="nav" size={16} />Directions</a>}
        <a className="btn ghost" href={river.filingsUrl} target="_blank" rel="noopener">Tribal filings</a>
        <a className="btn ghost" href={river.regsUrl} target="_blank" rel="noopener">WAC rules</a>
        {status === 'err' && <button type="button" className="btn sm" onClick={() => loadRiver(true)}>Retry feed</button>}
      </div>
      <div className="note" style={{ paddingTop: 8 }}>
        {stale ? 'Net dates below are from last season and are no longer current. ' : ''}{river.sourceNote}
        {feed?.error ? ' Could not reach the tribe\'s page just now, so new filings are not being checked.' : ''}
        {' '}Last window on file ends {localDate(river.nets[river.nets.length - 1].close).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
      </div>
    </div>
  );
}
