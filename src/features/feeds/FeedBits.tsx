import { useEffect } from 'react';
import type { Rule, Plant, EscapementRow } from '@/api/feeds';
import { daysAgo } from '@/api/feeds';
import { fmtDate } from '@/lib/util';
import { useFeeds } from '@/store/feeds';
import { Empty } from '@/components/ui';

/** Kicks off the WDFW feed loads once; safe to mount in several places. */
export function useFeedLoads(which: ('rules' | 'plants' | 'escapement')[]) {
  const loadRules = useFeeds(s => s.loadRules);
  const loadPlants = useFeeds(s => s.loadPlants);
  const loadEscapement = useFeeds(s => s.loadEscapement);
  useEffect(() => {
    const st = useFeeds.getState();
    if (which.includes('rules') && st.rulesStatus === 'idle') loadRules();
    if (which.includes('plants') && st.plantsStatus === 'idle') loadPlants();
    if (which.includes('escapement') && st.escStatus === 'idle') loadEscapement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const KIND_CLASS: Record<Rule['kind'], string> = { open: 'ok', close: 'hot', change: 'warn' };
const KIND_LABEL: Record<Rule['kind'], string> = { open: 'Opens', close: 'Closes', change: 'Change' };

export function RuleCard({ r, compact }: { r: Rule; compact?: boolean }) {
  return (
    <a className="item" href={r.link} target="_blank" rel="noopener" style={{ gridTemplateColumns: '1fr', textDecoration: 'none' }}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="nm" style={{ flex: 1 }}>{r.title}</div>
          <span className={`badge ${KIND_CLASS[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
        </div>
        {r.effective && <div className="sub">Effective {r.effective}</div>}
        {!compact && r.species && <div className="sub">Species: {r.species}</div>}
        {!compact && r.action && <div className="sub" style={{ marginTop: 4, color: 'var(--ink)' }}>{r.action}</div>}
        {!compact && r.rules && <div className="sub" style={{ marginTop: 4 }}>{r.rules.length > 260 ? r.rules.slice(0, 260) + '...' : r.rules}</div>}
        {r.published && <div className="sub" style={{ marginTop: 4 }}>Posted {fmtDate(r.published.slice(0, 10))}{r.counties.length ? ' - ' + r.counties.join(', ') + ' County' : ''}</div>}
      </div>
    </a>
  );
}

export function RulesList({ rules, empty, compact }: { rules: Rule[]; empty: string; compact?: boolean }) {
  if (!rules.length) return <Empty>{empty}</Empty>;
  return <div className="list">{rules.map(r => <RuleCard key={r.id} r={r} compact={compact} />)}</div>;
}

export function PlantRow({ p }: { p: Plant }) {
  const d = daysAgo(p.date);
  return (
    <div className="item" style={{ cursor: 'default' }}>
      <span className="pin" style={{ background: d <= 7 ? 'var(--green)' : d <= 21 ? 'var(--amber)' : 'var(--muted)' }} />
      <div style={{ minWidth: 0 }}>
        <div className="nm">{p.number.toLocaleString()} {p.species}</div>
        <div className="sub">{fmtDate(p.date)} ({d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`}){p.fish_per_lb ? ` - ${p.fish_per_lb} per lb` : ''}{p.hatchery ? ` - ${p.hatchery}` : ''}</div>
      </div>
      <div className="right">{p.county}</div>
    </div>
  );
}

export function sizeLabel(fpl: number | null): string {
  if (fpl == null) return '';
  if (fpl <= 1) return 'jumbo';
  if (fpl <= 2.5) return 'large';
  if (fpl <= 4) return 'catchable';
  return 'fry';
}

export function EscRow({ r, species }: { r: EscapementRow; species: string }) {
  const delta = r.delta;
  return (
    <div className="item" style={{ cursor: 'default' }}>
      <span className="pin" style={{ background: delta != null && delta > 0 ? 'var(--green)' : 'var(--muted)' }} />
      <div style={{ minWidth: 0 }}>
        <div className="nm">{species}</div>
        <div className="sub">{r.stock}{r.date ? ` - as of ${r.date}` : ''}{r.comments ? ` - ${r.comments}` : ''}</div>
      </div>
      <div className="right">
        <b>{r.adult_total != null ? r.adult_total.toLocaleString() : '-'}</b>
        {delta != null ? (delta > 0 ? `+${delta.toLocaleString()} this week` : delta === 0 ? 'no change' : `${delta.toLocaleString()} this week`) : r.jack_total != null ? `${r.jack_total.toLocaleString()} jacks` : ''}
      </div>
    </div>
  );
}
