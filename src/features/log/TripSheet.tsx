import { useMemo } from 'react';
import { Sheet, Empty, Icon } from '@/components/ui';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { LAKE_BY_SLUG } from '@/data/lakes';
import { speciesColor, speciesLabel } from '@/data/species';
import { fmtDate, fmtClock } from '@/lib/util';
import type { Spot } from '@/lib/types';

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp, so trips show the day they happened here. */
export function localDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${fmtDate(localDateStr(iso))} ${fmtClock(d)}`;
}

export function waterName(id: string, spots: Spot[]): string {
  const lake = LAKE_BY_SLUG[id];
  if (lake) return lake.name;
  const spot = spots.find(s => s.id === id);
  return spot ? spot.name : id;
}

export function TripSheet({ tripId }: { tripId: string }) {
  const closeSheet = useUI(s => s.closeSheet);
  const openSheet = useUI(s => s.openSheet);
  const fly = useUI(s => s.fly);
  const trips = useData(s => s.trips);
  const catches = useData(s => s.catches);
  const spots = useData(s => s.spots);
  const profiles = useData(s => s.profiles);

  const trip = useMemo(() => trips.find(t => t.id === tripId) || null, [trips, tripId]);
  const waters = useMemo(() => (trip?.lakes || []).map(id => ({ id, name: waterName(id, spots) })), [trip, spots]);
  const tripCatches = useMemo(() => {
    const ids = new Set(trip?.catch_ids || []);
    return catches.filter(c => ids.has(c.id)).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [trip, catches]);

  if (!trip) {
    return <Sheet title="Trip" onClose={closeSheet}><Empty>This trip is no longer in the log.</Empty></Sheet>;
  }

  const who = profiles[trip.user_id];
  const hasTrack = !!(trip.track && trip.track.length);
  const title = `Trip ${fmtDate(localDateStr(trip.started_at))}`.trim();

  const showOnMap = () => {
    if (!trip.track || !trip.track.length) return;
    const p = trip.track[0];
    closeSheet();
    fly(p.lat, p.lng, 12);
  };

  return (
    <Sheet
      title={title}
      sub={who ? who.name : undefined}
      onClose={closeSheet}
      footer={hasTrack ? <button type="button" className="btn" onClick={showOnMap}><Icon name="map" />Show on map</button> : undefined}
    >
      <div className="kv">
        <div className="k">Start</div><div className="v">{fmtStamp(trip.started_at) || 'n/a'}</div>
        <div className="k">End</div><div className="v">{fmtStamp(trip.ended_at) || 'n/a'}</div>
        <div className="k">Duration</div><div className="v">{trip.duration_min != null ? `${trip.duration_min} min` : 'n/a'}</div>
        <div className="k">Distance</div><div className="v">{trip.distance_mi != null ? `${trip.distance_mi.toFixed(1)} mi` : 'n/a'}</div>
        {hasTrack && <><div className="k">Track points</div><div className="v">{trip.track!.length}</div></>}
        {trip._local && <><div className="k">Sync</div><div className="v"><span className="badge warn">Not synced</span></div></>}
      </div>

      <div className="section">
        <h3>Waters <small>{waters.length}</small></h3>
        {waters.length
          ? <div className="chips">{waters.map(w => <span key={w.id} className="chip">{w.name}</span>)}</div>
          : <Empty>No lake or spot near the track.</Empty>}
      </div>

      <div className="section">
        <h3>Catches <small>{tripCatches.length}</small></h3>
        {tripCatches.length ? (
          <div className="list">
            {tripCatches.map(c => (
              <div key={c.id} className="jcard" role="button" tabIndex={0} onClick={() => openSheet({ kind: 'catchView', catchId: c.id })} onKeyDown={e => { if (e.key === 'Enter') openSheet({ kind: 'catchView', catchId: c.id }); }}>
                <div>
                  <div className="t"><span style={{ color: speciesColor(c.species) }}>{speciesLabel(c.species)}</span>{(c.qty || 1) > 1 ? ` x${c.qty}` : ''}{c.length != null ? ` · ${c.length} in` : ''}</div>
                  <div className="d">{c.lake_name || waterName(c.lake_id, spots)} · {fmtDate(c.date)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>No catches logged during this trip.</Empty>}
      </div>

      {trip.note && (
        <div className="section">
          <h3>Note</h3>
          <div className="note" style={{ whiteSpace: 'pre-wrap' }}>{trip.note}</div>
        </div>
      )}
    </Sheet>
  );
}
