import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/store/data';
import { useTrip, tripMinutes, fmtDuration } from '@/store/trip';
import { useUI } from '@/store/ui';
import { LAKE_SPECIES, CREEK_SPECIES, spById, speciesLabel } from '@/data/species';
import { snapshot, withGauge, condText } from '@/api/conditions';
import { needsCard, areaCode } from '@/domain/crc';
import { todayStr, lsGet, lsSet } from '@/lib/util';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/ui';
import type { Catch, Conditions, SpeciesId, WaterType } from '@/lib/types';

const RECENT_KEY = 'wff-recent-species';

function readRecent(): string[] {
  try { return JSON.parse(lsGet(RECENT_KEY) || '[]') as string[]; } catch { return []; }
}
function pushRecent(id: string) {
  const next = [id, ...readRecent().filter(x => x !== id)].slice(0, 5);
  lsSet(RECENT_KEY, JSON.stringify(next));
}

export interface QuickWater {
  id: string;
  name: string;
  type: WaterType;
  spotId?: string | null;
  lat?: number | null;
  lng?: number | null;
  gauge?: string | null;
  /** What WDFW lists for this water. Those chips come first, because they are what you will tap. */
  species?: readonly SpeciesId[];
}

/**
 * One tap logs a fish.
 *
 * The old form asked for twelve fields. Nobody fills twelve fields standing in a river with a
 * fish in one hand, so the log stayed empty and the app learned nothing. Here the only required
 * input is which species; the water, the clock, the trip and the conditions are all things the
 * app already knows, and it fills them silently.
 *
 * Everything else is an edit you make later from the couch. A logged fish with no detail beats an
 * unlogged fish with twelve fields, every time.
 *
 * The one exception is a kept salmon or steelhead, where WDFW wants a Catch Record Card line
 * before you carry on fishing. For those the card asks two more taps, kept or released and
 * clipped or wild, because that is a legal record and guessing it would be worse than asking.
 */
export function QuickCatch({ water, onLogged }: { water: QuickWater; onLogged?: (c: Catch) => void }) {
  const saveCatch = useData(s => s.saveCatch);
  const updateCatch = useData(s => s.updateCatch);
  const logVisit = useData(s => s.logVisit);
  const openSheet = useUI(s => s.openSheet);
  const active = useTrip(s => s.active);
  const attach = useTrip(s => s.attach);

  const [busy, setBusy] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [last, setLast] = useState<Catch | null>(null);
  const [askCard, setAskCard] = useState<Catch | null>(null);
  const condRef = useRef<Promise<Conditions> | null>(null);

  /**
   * Chip order is what makes this one tap rather than one scroll: what you logged last, then what
   * this water actually holds, then everything else behind a More button. Six fit above the fold
   * on a phone, which is the whole point.
   */
  const { list, rest } = useMemo(() => {
    const base = (water.type === 'lake' ? LAKE_SPECIES : CREEK_SPECIES) as SpeciesId[];
    const seen = new Set<SpeciesId>();
    const push = (arr: SpeciesId[], sp: SpeciesId) => { if (!seen.has(sp) && base.includes(sp)) { seen.add(sp); arr.push(sp); } };
    const top: SpeciesId[] = [];
    for (const r of readRecent()) push(top, r as SpeciesId);
    for (const sp of water.species || []) push(top, sp);
    const tail: SpeciesId[] = [];
    for (const sp of base) push(tail, sp);
    return { list: top.concat(tail).slice(0, 6), rest: top.concat(tail).slice(6) };
  }, [water.type, water.species]);

  // Warm the conditions call as soon as the panel is on screen, so the tap itself never waits.
  useEffect(() => {
    if (water.lat == null || water.lng == null) { condRef.current = null; return; }
    condRef.current = snapshot(water.lat, water.lng).then(c => withGauge(c, water.gauge));
  }, [water.lat, water.lng, water.gauge]);

  const log = async (sp: SpeciesId) => {
    if (busy) return;
    setBusy(sp);
    try {
      const cond = condRef.current ? await condRef.current.catch(() => null) : null;
      const row = await saveCatch({
        lake_id: water.id, lake_name: water.name, water_type: water.type, spot_id: water.spotId ?? null,
        species: sp, qty: 1, date: todayStr(), caught_at: new Date().toISOString(),
        trip_id: active?.id ?? null, cond,
        lat: water.lat ?? null, lng: water.lng ?? null, share_spot: false,
        catch_area: needsCard(sp) ? areaCode(water.id, water.name) : null,
      });
      pushRecent(sp);
      if (active) attach(row.id);
      logVisit(water.id, water.name, water.type, water.spotId ?? null).catch(() => {});
      setLast(row);
      if (needsCard(sp)) setAskCard(row);
      else toast(`${speciesLabel(sp)} logged`);
      onLogged?.(row);
      // Re-warm for the next fish.
      if (water.lat != null && water.lng != null) condRef.current = snapshot(water.lat, water.lng).then(c => withGauge(c, water.gauge));
    } catch (e) {
      toast('Could not save: ' + String((e as Error)?.message || e), 'err');
    } finally {
      setBusy(null);
    }
  };

  const answerCard = async (kept: boolean, clipped: boolean | null) => {
    const c = askCard;
    setAskCard(null);
    if (!c) return;
    await updateCatch(c.id, { kept, clipped });
    toast(kept ? 'On your Catch Record Card' : 'Released, nothing to record');
  };

  return (
    <div className="section" style={{ marginTop: 8 }}>
      <h3 style={{ margin: 0 }}>Log a fish <small>{water.name}</small></h3>
      <div className="note" style={{ padding: '4px 0 8px' }}>Tap the species. Time, water, weather and your trip are filled in for you. Add length, bait or a photo later.</div>

      <div className="chips" style={{ gap: 8 }}>
        {(more ? list.concat(rest) : list).map(sp => {
          const def = spById[sp];
          const on = busy === sp;
          return (
            <button
              key={sp}
              type="button"
              className="chip"
              disabled={!!busy}
              onClick={() => log(sp)}
              style={{
                minHeight: 46, fontSize: 14, fontWeight: 600, paddingInline: 14,
                borderColor: on ? def?.color : undefined,
                opacity: busy && !on ? .5 : 1,
              }}
            >
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, background: def?.color || 'var(--muted)', marginRight: 7 }} />
              {on ? 'Saving' : def?.short || sp}
            </button>
          );
        })}
        {!more && rest.length > 0 && (
          <button type="button" className="chip" onClick={() => setMore(true)} style={{ minHeight: 46, fontSize: 14, paddingInline: 14, color: 'var(--muted)' }}>
            More ({rest.length})
          </button>
        )}
      </div>

      {/* Card species need two more taps, and only these. */}
      {askCard && (
        <div className="stat" style={{ marginTop: 10, borderColor: 'rgba(234,162,76,.5)' }}>
          <div className="l">Catch Record Card</div>
          <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>
            WDFW wants a {speciesLabel(askCard.species)} written down before you carry on fishing. Did you keep it?
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="btn sm primary" onClick={() => answerCard(true, true)}>Kept, clipped</button>
            <button type="button" className="btn sm primary" onClick={() => answerCard(true, false)}>Kept, wild</button>
            <button type="button" className="btn sm" onClick={() => answerCard(false, null)}>Released</button>
          </div>
        </div>
      )}

      {last && !askCard && (
        <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div className="nm" style={{ fontSize: 13 }}>{speciesLabel(last.species)} logged</div>
              <button type="button" className="btn sm ghost" onClick={() => openSheet({ kind: 'catchView', catchId: last.id })}>Add detail</button>
            </div>
            {condText(last.cond) && <div className="sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>{condText(last.cond)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Start and end a trip. A trip is what turns loose catches into an answer: three hours on Ohop
 * with nothing is exactly the thing you want to know next year, and it only exists if the blank
 * session gets recorded too.
 */
export function TripBar({ water }: { water: QuickWater }) {
  const active = useTrip(s => s.active);
  const start = useTrip(s => s.start);
  const clear = useTrip(s => s.clear);
  const setNote = useTrip(s => s.setNote);
  const stale = useTrip(s => s.stale);
  const saveTrip = useData(s => s.saveTrip);
  const catches = useData(s => s.catches);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  // Keep the running clock honest without re-rendering the whole panel every second.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [active]);
  void tick;

  const onStart = async () => {
    const id = crypto.randomUUID();
    start({ id, waterId: water.id, waterName: water.name, waterType: water.type, spotId: water.spotId ?? null, cond: null });
    if (water.lat != null && water.lng != null) {
      snapshot(water.lat, water.lng).then(c => withGauge(c, water.gauge)).then(cond => {
        const a = useTrip.getState().active;
        if (a && a.id === id) useTrip.setState({ active: { ...a, cond } });
      }).catch(() => { /* a trip without weather is still a trip */ });
    }
    toast('Trip started');
  };

  const onEnd = async (endedAt?: string) => {
    const a = active;
    if (!a || saving) return;
    setSaving(true);
    try {
      const end = endedAt || new Date().toISOString();
      await saveTrip({
        id: a.id, started_at: a.startedAt, ended_at: end, duration_min: tripMinutes(a.startedAt, end),
        lakes: [a.waterId], catch_ids: a.catchIds, note: a.note || null,
        water_id: a.waterId, water_name: a.waterName, water_type: a.waterType, spot_id: a.spotId,
        cond: a.cond, open: false,
      });
      clear();
      toast(a.catchIds.length ? `Trip saved, ${a.catchIds.length} fish` : 'Trip saved, no fish. That counts too.');
    } catch (e) {
      toast('Could not save the trip: ' + String((e as Error)?.message || e), 'err');
    } finally { setSaving(false); }
  };

  if (!active) {
    return (
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={onStart}><Icon name="plan" size={16} />Start a trip here</button>
      </div>
    );
  }

  const mins = tripMinutes(active.startedAt, new Date().toISOString());
  const isStale = stale();
  // A trip left open overnight should end at the last fish, not at whatever time you notice.
  const lastCatch = active.catchIds.length
    ? catches.filter(c => active.catchIds.includes(c.id)).map(c => c.caught_at || c.created_at).sort().slice(-1)[0]
    : null;

  return (
    <div className="stat" style={{ marginTop: 8, borderColor: isStale ? 'rgba(234,162,76,.5)' : 'rgba(58,208,255,.4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="l">On the water</div>
        <span className="badge water">{fmtDuration(mins)}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginTop: 4 }}>
        {active.waterName} · {active.catchIds.length} fish
      </div>
      {isStale && (
        <div className="note" style={{ paddingTop: 6 }}>
          This trip started {new Date(active.startedAt).toLocaleDateString(undefined, { weekday: 'long' })} and is still open.
          {lastCatch ? ' End it at your last fish rather than now.' : ''}
        </div>
      )}
      <input
        className="in"
        placeholder="Note for this trip"
        defaultValue={active.note}
        onBlur={e => setNote(e.target.value)}
        style={{ marginTop: 8 }}
      />
      <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" disabled={saving} onClick={() => onEnd()}>End trip</button>
        {isStale && lastCatch && <button type="button" className="btn" disabled={saving} onClick={() => onEnd(lastCatch)}>End at last fish</button>}
        <button type="button" className="btn ghost" disabled={saving} onClick={() => { if (confirm('Throw this trip away? Fish you logged are kept.')) clear(); }}>Discard</button>
      </div>
    </div>
  );
}
