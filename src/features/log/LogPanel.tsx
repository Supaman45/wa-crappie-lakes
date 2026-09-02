import { useMemo, useState } from 'react';
import { Chip, Empty, Icon } from '@/components/ui';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { SPECIES, speciesColor, speciesLabel } from '@/data/species';
import { totals, monthHeat, leaderboard, records, insights, catchesCsv, visitsCsv, shareText } from '@/domain/journal';
import { photoUrl } from '@/lib/supabase';
import { fmtDate, todayStr } from '@/lib/util';
import { toast } from '@/lib/toast';
import { localDateStr, waterName } from './TripSheet';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SPECIES_ORDER: Record<string, number> = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));

export function LogPanel() {
  const openSheet = useUI(s => s.openSheet);
  const catches = useData(s => s.catches);
  const visits = useData(s => s.visits);
  const trips = useData(s => s.trips);
  const profiles = useData(s => s.profiles);
  const spots = useData(s => s.spots);
  const outboxCount = useData(s => s.outboxCount);

  const [who, setWho] = useState<string>('all');
  const [species, setSpecies] = useState<string | null>(null);

  const crew = useMemo(() => Object.values(profiles).sort((a, b) => a.name.localeCompare(b.name)), [profiles]);

  const byWho = useMemo(() => who === 'all' ? catches : catches.filter(c => c.user_id === who), [catches, who]);
  const fVisits = useMemo(() => who === 'all' ? visits : visits.filter(v => v.user_id === who), [visits, who]);
  const fTrips = useMemo(() => {
    const rows = who === 'all' ? trips : trips.filter(t => t.user_id === who);
    return rows.slice().sort((a, b) => (b.started_at || b.created_at || '').localeCompare(a.started_at || a.created_at || ''));
  }, [trips, who]);

  const speciesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const c of byWho) set.add(c.species || 'crappie');
    return Array.from(set).sort((a, b) => (SPECIES_ORDER[a] ?? 99) - (SPECIES_ORDER[b] ?? 99) || a.localeCompare(b));
  }, [byWho]);

  const fCatches = useMemo(() => species ? byWho.filter(c => (c.species || 'crappie') === species) : byWho, [byWho, species]);

  const tot = useMemo(() => totals(fCatches, fVisits, fTrips), [fCatches, fVisits, fTrips]);
  const recent = useMemo(() => fCatches.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 60), [fCatches]);
  const heat = useMemo(() => monthHeat(fCatches), [fCatches]);
  const heatMax = useMemo(() => Math.max(1, ...heat), [heat]);
  const recs = useMemo(() => records(fCatches, profiles), [fCatches, profiles]);
  const board = useMemo(() => leaderboard(fCatches, fVisits, profiles), [fCatches, fVisits, profiles]);
  const tips = useMemo(() => insights(fCatches, fVisits), [fCatches, fVisits]);
  const recentTrips = useMemo(() => fTrips.slice(0, 20), [fTrips]);

  const exportCatches = () => {
    if (!fCatches.length) { toast('Nothing to export yet', 'warn'); return; }
    const rows = fCatches.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    shareText(`wff-catches-${todayStr()}.csv`, catchesCsv(rows, profiles)).then(() => toast(`Exported ${rows.length} catch${rows.length === 1 ? '' : 'es'}`), () => toast('Export failed', 'err'));
  };
  const exportVisits = () => {
    if (!fVisits.length) { toast('No visits logged yet', 'warn'); return; }
    const rows = fVisits.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    shareText(`wff-visits-${todayStr()}.csv`, visitsCsv(rows, profiles)).then(() => toast(`Exported ${rows.length} visit${rows.length === 1 ? '' : 's'}`), () => toast('Export failed', 'err'));
  };

  return (
    <div>
      <div className="controls">
        <div className="pill-row">
          <button type="button" className={`profile-pill${who === 'all' ? ' on' : ''}`} onClick={() => setWho('all')} aria-pressed={who === 'all'}>All</button>
          {crew.map(p => (
            <button key={p.id} type="button" className={`profile-pill${who === p.id ? ' on' : ''}`} onClick={() => setWho(who === p.id ? 'all' : p.id)} aria-pressed={who === p.id}>
              <i style={{ background: p.color }} />{p.name}
            </button>
          ))}
        </div>
        {speciesPresent.length > 0 && (
          <div className="chips">
            {speciesPresent.map(id => (
              <Chip key={id} on={species === id} color={speciesColor(id)} onClick={() => setSpecies(species === id ? null : id)}>{speciesLabel(id)}</Chip>
            ))}
          </div>
        )}
        {outboxCount > 0 && <div className="note">{outboxCount} item{outboxCount === 1 ? '' : 's'} waiting to sync.</div>}
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat"><div className="n">{tot.catches}</div><div className="l">Catches</div></div>
        <div className="stat"><div className="n">{tot.visits}</div><div className="l">Visits</div></div>
        <div className="stat"><div className="n">{tot.lakes}</div><div className="l">Waters</div></div>
        <div className="stat"><div className="n">{tot.trips}</div><div className="l">Trips</div></div>
      </div>

      <div className="section">
        <h3>Recent catches <small>{recent.length < fCatches.length ? `latest ${recent.length} of ${fCatches.length}` : `${fCatches.length}`}</small></h3>
        {recent.length ? (
          <div className="list">
            {recent.map(c => {
              const p = profiles[c.user_id];
              const url = photoUrl(c.photo_path);
              const size = [c.length != null ? `${c.length} in` : null, c.weight != null ? `${c.weight} lb` : null].filter(Boolean).join(' · ');
              return (
                <div key={c.id} className="jcard" role="button" tabIndex={0} onClick={() => openSheet({ kind: 'catchView', catchId: c.id })} onKeyDown={e => { if (e.key === 'Enter') openSheet({ kind: 'catchView', catchId: c.id }); }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t">
                      <span style={{ color: speciesColor(c.species) }}>{speciesLabel(c.species)}</span>
                      {(c.qty || 1) > 1 ? ` x${c.qty}` : ''}{size ? ` · ${size}` : ''}
                    </div>
                    <div className="d">{c.lake_name || waterName(c.lake_id, spots)} · {fmtDate(c.date)}{c._local ? ' · not synced' : ''}</div>
                    <div className="who"><i style={{ background: p?.color || '#8fa79e' }} />{p?.name || 'Angler'}</div>
                  </div>
                  {url && <img src={url} alt="" loading="lazy" decoding="async" style={{ gridColumn: 2 }} />}
                </div>
              );
            })}
          </div>
        ) : <Empty>No catches yet. Open a lake or spot and tap Log a catch.</Empty>}
      </div>

      <div className="section">
        <h3>By month <small>{fCatches.length ? 'fish per month' : ''}</small></h3>
        <div className="heat">
          {heat.map((n, i) => (
            <div key={i} className="cell" title={`${MONTH_NAMES[i]}: ${n}`} style={n > 0 ? { background: `rgba(79,180,119,${(0.18 + 0.72 * (n / heatMax)).toFixed(2)})`, color: 'var(--ink)' } : undefined}>{MONTH_INITIALS[i]}</div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Records</h3>
        {recs.length ? (
          <div className="list">
            {recs.map(r => (
              <div key={r.label} className="item" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
                <div><div className="nm">{r.label}</div><div className="sub">{r.sub}</div></div>
                <div className="right"><b>{r.value}</b></div>
              </div>
            ))}
          </div>
        ) : <Empty>Log a length or weight to start setting records.</Empty>}
      </div>

      <div className="section">
        <h3>Crew leaderboard</h3>
        {board.length ? (
          <div className="list">
            {board.map(r => (
              <div key={r.profile.id} className={`item${who === r.profile.id ? ' active' : ''}`} role="button" tabIndex={0} onClick={() => setWho(who === r.profile.id ? 'all' : r.profile.id)} onKeyDown={e => { if (e.key === 'Enter') setWho(who === r.profile.id ? 'all' : r.profile.id); }}>
                <span className="pin" style={{ background: r.profile.color }} />
                <div><div className="nm">{r.profile.name}</div><div className="sub">{r.catches} catch{r.catches === 1 ? '' : 'es'} · {r.visits} visit{r.visits === 1 ? '' : 's'}</div></div>
                <div className="right"><b>{r.biggest != null ? `${r.biggest} in` : 'n/a'}</b>biggest</div>
              </div>
            ))}
          </div>
        ) : <Empty>Nobody has logged anything yet.</Empty>}
      </div>

      <div className="section">
        <h3>Insights</h3>
        {tips.length ? tips.map((t, i) => <p key={i} className="note" style={{ margin: '0 0 6px' }}>{t.text}</p>) : <Empty>Insights show up after a few logged catches.</Empty>}
      </div>

      <div className="section">
        <h3>Trips <small>{fTrips.length > recentTrips.length ? `latest ${recentTrips.length} of ${fTrips.length}` : ''}</small></h3>
        {recentTrips.length ? (
          <div className="list">
            {recentTrips.map(t => {
              const p = profiles[t.user_id];
              const nWaters = (t.lakes || []).length;
              const nCatch = (t.catch_ids || []).length;
              return (
                <div key={t.id} className="item" role="button" tabIndex={0} onClick={() => openSheet({ kind: 'trip', tripId: t.id })} onKeyDown={e => { if (e.key === 'Enter') openSheet({ kind: 'trip', tripId: t.id }); }}>
                  <span className="pin" style={{ background: p?.color || '#8fa79e' }} />
                  <div>
                    <div className="nm">{fmtDate(localDateStr(t.started_at || t.created_at)) || 'Trip'}{p ? ` · ${p.name}` : ''}</div>
                    <div className="sub">{nWaters} water{nWaters === 1 ? '' : 's'}{nCatch ? ` · ${nCatch} catch${nCatch === 1 ? '' : 'es'}` : ''}{t._local ? ' · not synced' : ''}</div>
                  </div>
                  <div className="right"><b>{(t.distance_mi ?? 0).toFixed(1)} mi</b>{t.duration_min ?? 0} min</div>
                </div>
              );
            })}
          </div>
        ) : <Empty>No trips yet. Tap Start trip on the map to record one.</Empty>}
      </div>

      <div className="section">
        <h3>Export</h3>
        <div className="row">
          <button type="button" className="btn" onClick={exportCatches}><Icon name="share" />Catches CSV</button>
          <button type="button" className="btn" onClick={exportVisits}><Icon name="share" />Visits CSV</button>
        </div>
        <div className="note" style={{ marginTop: 8 }}>Synced live to your crew's shared log.</div>
      </div>
    </div>
  );
}
