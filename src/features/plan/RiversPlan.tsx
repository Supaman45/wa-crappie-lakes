import { useEffect, useMemo, useState } from 'react';
import { RIVERS, RIVER_REGIONS, type River } from '@/data/rivers';
import { gaugesBySites, gaugeHistory, type Gauge, type GaugeHistory } from '@/api/usgs';
import { rulesFor, type EscapementRow } from '@/api/feeds';
import { speciesColor, speciesLabel } from '@/data/species';
import { haversine, cToF, dirUrl, lsGet, lsSet } from '@/lib/util';
import { useUI } from '@/store/ui';
import { useFeeds } from '@/store/feeds';
import { Chip, Icon, Empty } from '@/components/ui';
import { useFeedLoads, RulesList, EscRow } from '@/features/feeds/FeedBits';

type RegionFilter = River['region'] | 'all';

function median(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Plain-language read of a flow against its 30-day median. */
function flowLabel(cfs: number | null, med: number | null): { label: string; cls: string } | null {
  if (cfs == null) return null;
  if (med == null || med <= 0) return { label: 'flow', cls: '' };
  const r = cfs / med;
  if (r >= 1.6) return { label: 'high, blown out', cls: 'hot' };
  if (r >= 1.2) return { label: 'above normal', cls: 'warn' };
  if (r <= 0.6) return { label: 'low and clear', cls: 'warn' };
  return { label: 'near normal', cls: 'ok' };
}

function tempLabel(c: number | null): { label: string; cls: string } | null {
  if (c == null) return null;
  const f = cToF(c);
  if (f >= 68) return { label: `${Math.round(f)}°F warm, rest fish fast`, cls: 'hot' };
  if (f >= 60) return { label: `${Math.round(f)}°F`, cls: 'warn' };
  return { label: `${Math.round(f)}°F`, cls: 'ok' };
}

interface EscSummary { species: string; rows: EscapementRow[]; adults: number; delta: number | null }

export function RiversPlan() {
  useFeedLoads(['rules', 'escapement']);
  const origin = useUI(s => s.origin);
  const fly = useUI(s => s.fly);
  const rules = useFeeds(s => s.rules);
  const rulesStatus = useFeeds(s => s.rulesStatus);
  const esc = useFeeds(s => s.escapement);
  const escStatus = useFeeds(s => s.escStatus);

  const [region, setRegion] = useState<RegionFilter>(() => (lsGet('wff-river-region') as RegionFilter) || 'all');
  const [gauges, setGauges] = useState<Record<string, Gauge>>({});
  const [gState, setGState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [openId, setOpenId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => { lsSet('wff-river-region', region); }, [region]);

  useEffect(() => {
    const ac = new AbortController();
    setGState('loading');
    gaugesBySites(RIVERS.map(r => r.gauge || '').filter(Boolean), ac.signal)
      .then(g => { if (!ac.signal.aborted) { setGauges(g); setGState('ok'); } })
      .catch(() => { if (!ac.signal.aborted) setGState('err'); });
    return () => ac.abort();
  }, [nonce]);

  const escByFacility = useMemo(() => {
    const m: Record<string, { species: string; row: EscapementRow }[]> = {};
    for (const s of esc?.latest.species || []) for (const r of s.rows) (m[r.facility] ||= []).push({ species: s.species, row: r });
    return m;
  }, [esc]);

  const list = useMemo(() => {
    const dist = (r: River) => origin ? haversine(origin.lat, origin.lng, r.lat, r.lng) : null;
    return RIVERS
      .filter(r => region === 'all' || r.region === region)
      .map(r => {
        const g = r.gauge ? gauges[r.gauge] : undefined;
        const hits = r.facilities.flatMap(f => escByFacility[f] || []);
        const bySp: Record<string, EscSummary> = {};
        for (const h of hits) {
          const e = bySp[h.species] || (bySp[h.species] = { species: h.species, rows: [], adults: 0, delta: null });
          e.rows.push(h.row);
          e.adults += h.row.adult_total || 0;
          if (h.row.delta != null) e.delta = (e.delta || 0) + h.row.delta;
        }
        const escs = Object.values(bySp).sort((a, b) => b.adults - a.adults);
        const matched = rulesFor(rules, r.name, r.counties);
        return { r, g: g || null, d: dist(r), escs, rules: matched };
      })
      .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || a.r.name.localeCompare(b.r.name));
  }, [region, gauges, escByFacility, rules, origin]);

  return (
    <div>
      <div className="section" style={{ marginTop: 8 }}>
        <h3>Rivers <small>{origin ? `nearest first from ${origin.label}` : 'set a start point on Lakes to sort by distance'}</small></h3>
        <div className="chips" style={{ marginBottom: 8 }}>
          <Chip on={region === 'all'} onClick={() => setRegion('all')}>All</Chip>
          {RIVER_REGIONS.map(x => <Chip key={x.id} on={region === x.id} onClick={() => setRegion(x.id)}>{x.label}</Chip>)}
        </div>
        <div className="note" style={{ paddingBottom: 8 }}>
          Live USGS flow and water temperature, this week's WDFW hatchery returns, and any emergency rule that names the river. Tap a river for details.
          {gState === 'err' && <> Gauges did not load. <button className="btn sm" onClick={() => setNonce(n => n + 1)}>Retry</button></>}
          {escStatus === 'err' && <> Hatchery report did not load.</>}
          {rulesStatus === 'err' && <> Emergency rules did not load.</>}
        </div>
        {esc?.latest.reportDate && <div className="meta"><span>Hatchery report for week of {esc.latest.reportDate}</span><a href={esc.latest.url} target="_blank" rel="noopener">PDF</a></div>}
        {!list.length && <Empty>No rivers in this region.</Empty>}
        <div className="list">
          {list.map(({ r, g, d, escs, rules: rr }) => {
            const open = openId === r.id;
            const t = tempLabel(g?.tempC ?? null);
            const topEsc = escs[0];
            return (
              <div key={r.id} className={`item${open ? ' active' : ''}`} style={{ gridTemplateColumns: '1fr', cursor: 'pointer' }} onClick={() => setOpenId(open ? null : r.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpenId(open ? null : r.id); }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nm">{r.name}</div>
                      <div className="sub">{r.counties.join(', ')}{d != null ? ` - ${Math.round(d)} mi` : ''}</div>
                    </div>
                    <div className="right">
                      <b>{g?.cfs != null ? `${Math.round(g.cfs).toLocaleString()} cfs` : r.gauge ? (gState === 'loading' ? '...' : 'no gauge data') : 'no gauge'}</b>
                      {t && <span className={`badge ${t.cls}`}>{t.label}</span>}
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                    {rr.length > 0 && <span className={`badge ${rr.some(x => x.kind === 'close') ? 'hot' : 'warn'}`}>{rr.length} rule{rr.length === 1 ? '' : 's'}</span>}
                    {topEsc && <span className="badge water">{topEsc.species}: {topEsc.adults.toLocaleString()}{topEsc.delta != null && topEsc.delta > 0 ? ` (+${topEsc.delta.toLocaleString()})` : ''}</span>}
                    {escs.length > 1 && <span className="badge">+{escs.length - 1} more</span>}
                  </div>
                  {open && <RiverDetail r={r} g={g} escs={escs} rules={rr} onMap={() => fly(r.lat, r.lng, 11)} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RiverDetail({ r, g, escs, rules, onMap }: { r: River; g: Gauge | null; escs: EscSummary[]; rules: ReturnType<typeof rulesFor>; onMap: () => void }) {
  const [hist, setHist] = useState<GaugeHistory | null>(null);
  useEffect(() => {
    if (!r.gauge) return;
    let live = true;
    gaugeHistory(r.gauge, 30).then(h => { if (live) setHist(h); }).catch(() => { /* keep card usable */ });
    return () => { live = false; };
  }, [r.gauge]);
  const med = hist ? median(hist.cfs) : null;
  const fl = flowLabel(g?.cfs ?? null, med);
  const last7 = hist ? hist.cfs.slice(-7).filter((x): x is number => x != null) : [];
  const trend = last7.length >= 2 ? (last7[last7.length - 1] / (last7[0] || 1)) : null;
  const trendLabel = trend == null ? null : trend >= 1.15 ? 'rising' : trend <= 0.87 ? 'dropping' : 'steady';

  return (
    <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
      <div className="kv">
        <div className="k">Gauge</div><div className="v">{r.gauge ? r.gaugeName : 'none listed'}</div>
        <div className="k">Flow</div><div className="v">{g?.cfs != null ? `${Math.round(g.cfs).toLocaleString()} cfs` : '-'}{fl ? ` (${fl.label})` : ''}</div>
        <div className="k">30-day median</div><div className="v">{med != null ? `${Math.round(med).toLocaleString()} cfs` : '-'}</div>
        <div className="k">7-day trend</div><div className="v">{trendLabel || '-'}</div>
        <div className="k">Water temp</div><div className="v">{g?.tempC != null ? `${Math.round(cToF(g.tempC))}°F` : '-'}</div>
        <div className="k">Species</div><div className="v" style={{ textAlign: 'left', fontWeight: 500 }}>{r.sp.map(s => <span key={s} style={{ color: speciesColor(s), marginRight: 6 }}>{speciesLabel(s)}</span>)}</div>
      </div>
      {g?.at && <div className="note" style={{ paddingTop: 6 }}>Gauge reading {new Date(g.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.</div>}

      <div className="section" style={{ marginTop: 12 }}>
        <h3>Hatchery returns <small>{r.facilities.length ? r.facilities.map(f => f.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(', ') : 'no WDFW facility on this river'}</small></h3>
        {!escs.length && <div className="note">{r.facilities.length ? 'No rows for these facilities in this week\'s report.' : 'Returns are reported for rivers with a WDFW hatchery, weir, or trap.'}</div>}
        {escs.map(e => (
          <div key={e.species} className="list" style={{ marginBottom: 6 }}>
            {e.rows.map((row, i) => <EscRow key={i} r={row} species={e.species} />)}
          </div>
        ))}
        {escs.length > 0 && <div className="note" style={{ paddingTop: 4 }}>Adult totals to date this season. A rising count means fish are moving into the river now.</div>}
      </div>

      <div className="section" style={{ marginTop: 12 }}>
        <h3>Emergency rules <small>{rules.length ? `${rules.length} match` : 'none match'}</small></h3>
        <RulesList rules={rules} compact empty="No emergency rule names this river right now. Check the regulations pamphlet for the standing season." />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={onMap}><Icon name="map" size={16} />Show on map</button>
        <a className="btn" href={dirUrl(r.lat, r.lng)} target="_blank" rel="noopener"><Icon name="nav" size={16} />Directions</a>
        <a className="btn ghost" href={`https://wdfw.wa.gov/fishing/regulations/emergency-rules?search=${encodeURIComponent(r.name)}`} target="_blank" rel="noopener">WDFW rules</a>
      </div>
    </div>
  );
}
