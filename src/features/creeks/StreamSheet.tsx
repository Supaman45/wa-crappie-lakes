import { useEffect, useMemo, useState } from 'react';
import type { SpotAccess } from '@/lib/types';
import type { StreamPick } from '@/store/ui';
import type { Gauge, GaugeHistory } from '@/api/usgs';
import { gaugeHistory } from '@/api/usgs';
import { streamSpecies } from '@/api/wdfw';
import { creekScore, type StreamSpeciesRow } from '@/domain/creekScore';
import { speciesColor, speciesLabel } from '@/data/species';
import { haversine, cToF, dirUrl } from '@/lib/util';
import { toast } from '@/lib/toast';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useCreeks } from '@/features/creeks/store';
import { Sheet, Icon, Field, Score, Empty } from '@/components/ui';

const DOCUMENTED = /documented/i;
const GAUGE_MAX_MI = 25;
const BARRIER_MI = 2;
const ACCESS_MI = 3;

const BARRIER_LABEL: Record<string, string> = { total: 'Total', partial: 'Partial', natural: 'Natural', diversion: 'Diversion', unknown: 'Unknown' };

function median(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function trendOf(hist: GaugeHistory | null): { label: string; first: number; last: number } | null {
  if (!hist) return null;
  const last7 = hist.cfs.slice(-7).filter((x): x is number => x != null && Number.isFinite(x));
  if (last7.length < 2) return null;
  const first = last7[0], last = last7[last7.length - 1];
  const ratio = first > 0 ? last / first : 1;
  const label = ratio >= 1.15 ? 'rising' : ratio <= 0.87 ? 'falling' : 'steady';
  return { label, first, last };
}

export function StreamSheet({ pick }: { pick: StreamPick }) {
  const closeSheet = useUI(s => s.closeSheet);
  const openSheet = useUI(s => s.openSheet);
  const fly = useUI(s => s.fly);
  const saveSpot = useData(s => s.saveSpot);
  const gauges = useCreeks(s => s.gauges);
  const barriers = useCreeks(s => s.barriers);
  const access = useCreeks(s => s.access);

  const [rows, setRows] = useState<StreamSpeciesRow[]>(pick.species);
  const [rowsReady, setRowsReady] = useState(false);
  const [rowsNote, setRowsNote] = useState<string | null>(null);
  const [hist, setHist] = useState<GaugeHistory | null>(null);
  const [histReady, setHistReady] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(pick.name);
  const [spotAccess, setSpotAccess] = useState<SpotAccess>('unknown');
  const [permit, setPermit] = useState('');
  const [priority, setPriority] = useState(3);
  const [notes, setNotes] = useState('');

  // Full species list for the whole LLID, not only the viewport rows.
  useEffect(() => {
    let alive = true;
    setRows(pick.species); setRowsReady(false); setRowsNote(null);
    if (!pick.llid) { setRowsReady(true); return; }
    streamSpecies(pick.llid)
      .then(r => { if (!alive) return; if (r.length) setRows(r); setRowsReady(true); })
      .catch(() => { if (!alive) return; setRowsNote('Showing only the species in view, the full stream list did not load.'); setRowsReady(true); });
    return () => { alive = false; };
  }, [pick.llid, pick.species]);

  const nearest = useMemo(() => {
    let best: { gauge: Gauge; dist: number } | null = null;
    for (const g of gauges) { const d = haversine(pick.lat, pick.lng, g.lat, g.lng); if (!best || d < best.dist) best = { gauge: g, dist: d }; }
    return best;
  }, [gauges, pick.lat, pick.lng]);
  const gaugeInRange = nearest && nearest.dist <= GAUGE_MAX_MI ? nearest : null;

  useEffect(() => {
    let alive = true;
    setHist(null); setHistReady(false);
    if (!gaugeInRange) { setHistReady(true); return; }
    gaugeHistory(gaugeInRange.gauge.id, 30)
      .then(h => { if (alive) { setHist(h); setHistReady(true); } })
      .catch(() => { if (alive) setHistReady(true); });
    return () => { alive = false; };
  }, [gaugeInRange?.gauge.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const medianCfs = useMemo(() => hist ? median(hist.cfs) : null, [hist]);
  const trend = useMemo(() => trendOf(hist), [hist]);

  const nearBarriers = useMemo(() => barriers
    .map(b => ({ b, d: haversine(pick.lat, pick.lng, b.lat, b.lng) }))
    .filter(x => x.d <= BARRIER_MI)
    .sort((a, b) => a.d - b.d), [barriers, pick.lat, pick.lng]);
  const barrierCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { b } of nearBarriers) c[b.kind] = (c[b.kind] || 0) + 1;
    return c;
  }, [nearBarriers]);
  const nearAccess = useMemo(() => access
    .map(a => ({ a, d: haversine(pick.lat, pick.lng, a.lat, a.lng) }))
    .filter(x => x.d <= ACCESS_MI)
    .sort((a, b) => a.d - b.d), [access, pick.lat, pick.lng]);

  const ready = rowsReady && histReady;
  const score = useMemo(() => ready ? creekScore({
    rows, lat: pick.lat, lng: pick.lng,
    gauge: gaugeInRange?.gauge ?? null, gaugeDist: gaugeInRange?.dist ?? null,
    gaugeMedianCfs: medianCfs, barriers, access,
  }) : null, [ready, rows, pick.lat, pick.lng, gaugeInRange, medianCfs, barriers, access]);

  const appSpecies = useMemo(() => Array.from(new Set(rows.map(r => r.species).filter(s => s !== 'other'))), [rows]);
  const docMiles = useMemo(() => rows.reduce((m, r) => DOCUMENTED.test(r.dist) ? Math.max(m, r.miles) : m, 0), [rows]);
  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const da = DOCUMENTED.test(a.dist) ? 0 : 1, db = DOCUMENTED.test(b.dist) ? 0 : 1;
    return da - db || a.swifd.localeCompare(b.swifd) || a.use.localeCompare(b.use);
  }), [rows]);

  async function doSave() {
    const nm = name.trim();
    if (!nm) { toast('Give the spot a name', 'warn'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const spot = await saveSpot({
        kind: 'creek', name: nm, lat: pick.lat, lng: pick.lng, llid: pick.llid || null, species: appSpecies,
        meta: { score: score?.score ?? null, why: score?.why ?? null, gauge: gaugeInRange?.gauge.id ?? null, swifdRows: rows.length },
        access: spotAccess, permit: permit.trim() || null, priority, notes: notes.trim() || null,
      });
      toast(`Saved ${spot.name} as a spot`);
      openSheet({ kind: 'spot', spot });
    } catch (e) {
      toast((e as Error).message || 'Could not save the spot', 'err');
    } finally { setSaving(false); }
  }

  const sub = [
    pick.llid ? `LLID ${pick.llid}` : null,
    docMiles > 0 ? `${docMiles.toFixed(1)} mi documented` : pick.totalMiles > 0 ? `${pick.totalMiles.toFixed(1)} mi` : null,
    `${pick.lat.toFixed(4)}, ${pick.lng.toFixed(4)}`,
  ].filter(Boolean).join(' · ');

  const footer = showForm ? (
    <>
      <button type="button" className="btn primary" onClick={doSave} disabled={saving}><Icon name="check" />{saving ? 'Saving' : 'Save spot'}</button>
      <button type="button" className="btn ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
    </>
  ) : (
    <>
      <button type="button" className="btn primary" onClick={() => setShowForm(true)}><Icon name="pin" />Save as spot</button>
      <a className="btn" href={dirUrl(pick.lat, pick.lng)} target="_blank" rel="noopener"><Icon name="nav" />Directions</a>
      <button type="button" className="btn" onClick={() => { fly(pick.lat, pick.lng, 14); closeSheet(); }}><Icon name="locate" />Center map</button>
    </>
  );

  return (
    <Sheet title={pick.name} sub={sub} onClose={closeSheet} footer={footer}>
      {/* Score */}
      <div className="prow" style={{ cursor: 'default' }}>
        {score ? <Score n={score.score} /> : <div className="pscore" style={{ color: 'var(--faint)', borderColor: 'var(--line)' }}><span className="spinner" /></div>}
        <div style={{ minWidth: 0 }}>
          <div className="pname">Creek Score</div>
          <div className="pwhy">{score ? score.why : 'Working out the score'}</div>
          {score && (
            <div className="pmeta" style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '84px 1fr auto', gap: '3px 8px', alignItems: 'center' }}>
              {score.parts.map(p => (
                <PartBar key={p.label} label={p.label} pts={p.pts} max={p.max} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="section">
          <h3>New spot</h3>
          <div className="form">
            <Field label="Name" full><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={80} /></Field>
            <Field label="Access">
              <select className="select" value={spotAccess} onChange={e => setSpotAccess(e.target.value as SpotAccess)}>
                <option value="public">Public</option>
                <option value="timber">Timber permit</option>
                <option value="private">Private</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Permit"><input className="input" value={permit} onChange={e => setPermit(e.target.value)} placeholder="Permit name, if any" maxLength={80} /></Field>
            <Field label="Priority" full>
              <div className="chips">
                {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className={`chip${priority === n ? ' on' : ''}`} aria-pressed={priority === n} onClick={() => setPriority(n)}>{n}</button>)}
              </div>
            </Field>
            <Field label="Notes" full><textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="How to get there, what to try" /></Field>
          </div>
        </div>
      )}

      {/* Gauge */}
      <div className="section">
        <h3>Nearest gauge {gaugeInRange && <small>{gaugeInRange.dist.toFixed(1)} mi</small>}</h3>
        {!gaugeInRange ? (
          <Empty>{nearest ? `Nearest gauge is ${nearest.dist.toFixed(0)} mi away, too far to trust for this reach.` : 'No USGS gauge in view.'}</Empty>
        ) : (
          <>
            <div className="kv">
              <span className="k">Gauge</span><span className="v">{gaugeInRange.gauge.name}</span>
              <span className="k">Flow now</span><span className="v">{gaugeInRange.gauge.cfs != null ? `${Math.round(gaugeInRange.gauge.cfs).toLocaleString()} cfs` : 'n/a'}</span>
              <span className="k">30 day median</span><span className="v">{medianCfs != null ? `${Math.round(medianCfs).toLocaleString()} cfs` : histReady ? 'n/a' : 'loading'}</span>
              <span className="k">7 day trend</span><span className="v">{trend ? `${trend.label} (${Math.round(trend.first).toLocaleString()} to ${Math.round(trend.last).toLocaleString()} cfs)` : histReady ? 'n/a' : 'loading'}</span>
              <span className="k">Water temp</span><span className="v">{gaugeInRange.gauge.tempC != null ? `${Math.round(cToF(gaugeInRange.gauge.tempC))}°F` : 'n/a'}</span>
            </div>
            <div className="note" style={{ marginTop: 6 }}>
              <a href={`https://waterdata.usgs.gov/monitoring-location/${gaugeInRange.gauge.id}/`} target="_blank" rel="noopener">USGS {gaugeInRange.gauge.id}</a>
              {gaugeInRange.gauge.at ? `, as of ${new Date(gaugeInRange.gauge.at).toLocaleString()}` : ''}
            </div>
          </>
        )}
      </div>

      {/* Species */}
      <div className="section">
        <h3>Species on this stream <small>{rows.length} {rows.length === 1 ? 'row' : 'rows'}</small></h3>
        {rowsNote && <div className="note" style={{ marginBottom: 6, color: 'var(--amber)' }}>{rowsNote}</div>}
        {sortedRows.length === 0 ? <Empty>No SWIFD rows for this stream.</Empty> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 6px 4px 0', fontWeight: 600 }}>Species</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>Presence</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>Use</th>
                  <th style={{ padding: '4px 6px', fontWeight: 600 }}>Run</th>
                  <th style={{ padding: '4px 0 4px 6px', fontWeight: 600, textAlign: 'right' }}>Miles</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r, i) => (
                  <tr key={`${r.swifd}|${r.dist}|${r.use}|${r.run}|${i}`} style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '5px 6px 5px 0', whiteSpace: 'nowrap' }}>
                      <span className="badge" style={{ color: speciesColor(r.species) }}>{speciesLabel(r.species)}</span>
                      <div className="note" style={{ fontSize: 11 }}>{r.swifd}</div>
                    </td>
                    <td style={{ padding: '5px 6px', color: DOCUMENTED.test(r.dist) ? 'var(--ink)' : 'var(--muted)' }}>{r.dist || 'n/a'}</td>
                    <td style={{ padding: '5px 6px' }}>{r.use || 'n/a'}</td>
                    <td style={{ padding: '5px 6px' }}>{r.run || 'n/a'}</td>
                    <td style={{ padding: '5px 0 5px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.miles ? r.miles.toFixed(1) : 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barriers */}
      <div className="section">
        <h3>Barriers within {BARRIER_MI} mi <small>{nearBarriers.length}</small></h3>
        {nearBarriers.length === 0 ? <Empty>No mapped fish passage barriers within {BARRIER_MI} miles.</Empty> : (
          <>
            <div className="pill-row" style={{ marginBottom: 8 }}>
              {Object.entries(barrierCounts).map(([k, n]) => (
                <span key={k} className={`badge${k === 'total' ? ' hot' : k === 'partial' ? ' warn' : ''}`}>{n} {BARRIER_LABEL[k] || k}</span>
              ))}
            </div>
            <div className="list">
              {nearBarriers.slice(0, 3).map(({ b, d }) => (
                <div key={b.id} className="item" style={{ cursor: 'default' }}>
                  <span className="pin" style={{ background: b.kind === 'total' ? 'var(--red)' : b.kind === 'partial' ? 'var(--amber)' : b.kind === 'natural' ? 'var(--muted)' : 'var(--faint)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{BARRIER_LABEL[b.kind] || b.kind} barrier{b.feature ? `, ${b.feature}` : ''}</div>
                    <div className="sub">{[b.stream, b.owner].filter(Boolean).join(' · ') || 'no details'}</div>
                  </div>
                  <div className="right"><b>{d.toFixed(1)} mi</b>{b.gainMi != null ? `${b.gainMi.toFixed(1)} mi gain` : ''}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Access */}
      <div className="section">
        <h3>Access within {ACCESS_MI} mi <small>{nearAccess.length}</small></h3>
        {nearAccess.length === 0 ? <Empty>No mapped water access or shore site within {ACCESS_MI} miles. Check land ownership before you go.</Empty> : (
          <div className="list">
            {nearAccess.slice(0, 3).map(({ a, d }) => (
              <div key={a.id} className="item" style={{ cursor: 'default' }}>
                <span className="pin" style={{ background: 'var(--green)' }} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{a.name}</div>
                  <div className="sub">{a.kind === 'shore' ? 'Shore access' : a.launchType || 'Water access site'}{a.county ? `, ${a.county}` : ''}</div>
                </div>
                <div className="right">
                  <b>{d.toFixed(1)} mi</b>
                  <a className="btn sm ghost" href={dirUrl(a.lat, a.lng)} target="_blank" rel="noopener">Directions</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function PartBar({ label, pts, max }: { label: string; pts: number; max: number }) {
  const pct = max > 0 ? Math.round((pts / max) * 100) : 0;
  const col = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--faint)';
  return (
    <>
      <span>{label}</span>
      <span style={{ height: 6, borderRadius: 4, background: 'var(--panel-raised)', overflow: 'hidden' }} aria-hidden="true">
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: col }} />
      </span>
      <span style={{ color: 'var(--ink)' }}>{pts}/{max}</span>
    </>
  );
}
