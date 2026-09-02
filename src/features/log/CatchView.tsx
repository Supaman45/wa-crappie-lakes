import { useMemo, useState } from 'react';
import { Sheet, Empty, Icon } from '@/components/ui';
import { useUI } from '@/store/ui';
import { useData, currentUserId } from '@/store/data';
import { LAKE_BY_SLUG } from '@/data/lakes';
import { speciesColor, speciesLabel, spById } from '@/data/species';
import { photoUrl } from '@/lib/supabase';
import { fmtDate } from '@/lib/util';
import { toast } from '@/lib/toast';

const WATER_LABEL: Record<string, string> = { lake: 'Lake', creek: 'Creek', river: 'River', salt: 'Saltwater' };

export function CatchView({ catchId }: { catchId: string }) {
  const closeSheet = useUI(s => s.closeSheet);
  const setActiveLake = useUI(s => s.setActiveLake);
  const fly = useUI(s => s.fly);
  const catches = useData(s => s.catches);
  const profiles = useData(s => s.profiles);
  const spots = useData(s => s.spots);
  const deleteCatch = useData(s => s.deleteCatch);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const c = useMemo(() => catches.find(x => x.id === catchId) || null, [catches, catchId]);
  const lake = c ? LAKE_BY_SLUG[c.lake_id] : undefined;
  const spot = useMemo(() => c ? spots.find(s => s.id === (c.spot_id || c.lake_id)) : undefined, [spots, c]);

  if (!c) {
    return <Sheet title="Catch" onClose={closeSheet}><Empty>This catch is no longer in the log.</Empty></Sheet>;
  }

  const who = profiles[c.user_id];
  const waterName = c.lake_name || lake?.name || spot?.name || c.lake_id;
  const photo = photoUrl(c.photo_path);
  const mine = c.user_id === currentUserId();
  const canMap = !!lake || !!spot;

  const rows: [string, string][] = [];
  rows.push(['Date', fmtDate(c.date)]);
  rows.push(['Angler', who?.name || 'Angler']);
  rows.push(['Water', waterName]);
  rows.push(['Type', WATER_LABEL[c.water_type] || c.water_type]);
  rows.push(['How many', String(c.qty || 1)]);
  if (c.length != null) rows.push(['Length', `${c.length} in`]);
  if (c.weight != null) rows.push(['Weight', `${c.weight} lb`]);
  if (c.depth != null) rows.push(['Depth', `${c.depth} ft`]);
  if (c.water_temp != null) rows.push(['Water temp', `${c.water_temp} F`]);
  if (c.bait) rows.push(['Bait', c.bait]);
  if (c.structure) rows.push(['Structure', c.structure]);

  const showOnMap = () => {
    if (lake) { closeSheet(); setActiveLake(lake.id); return; }
    if (spot) { closeSheet(); fly(spot.lat, spot.lng, 14); return; }
    toast('No map location for this catch', 'warn');
  };

  const onDelete = async () => {
    if (!confirm) { setConfirm(true); return; }
    if (busy) return;
    setBusy(true);
    try {
      await deleteCatch(c.id);
      const still = useData.getState().catches.some(x => x.id === c.id);
      if (still) { setBusy(false); setConfirm(false); return; }
      toast('Catch deleted');
      closeSheet();
    } catch (e) {
      toast(String((e as Error)?.message || e || 'Delete failed'), 'err');
      setBusy(false); setConfirm(false);
    }
  };

  const title = mine ? 'Catch details' : `Catch by ${who?.name || 'angler'}`;

  return (
    <Sheet
      title={title}
      sub={waterName}
      onClose={closeSheet}
      footer={<>
        {canMap && <button type="button" className="btn" onClick={showOnMap}><Icon name="map" />Show on map</button>}
        {mine && (
          <button type="button" className="btn danger" onClick={onDelete} disabled={busy} style={{ marginLeft: 'auto' }}>
            <Icon name="trash" />{confirm ? 'Confirm delete' : 'Delete'}
          </button>
        )}
      </>}
    >
      {photo && (
        <div style={{ marginBottom: 12 }}>
          <img src={photo} alt={`${speciesLabel(c.species)} catch`} loading="lazy" decoding="async" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
        </div>
      )}
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <span className="badge" style={{ color: speciesColor(c.species) }}>{spById[c.species]?.name || c.species}</span>
        {(c.qty || 1) > 1 && <span className="badge">x{c.qty}</span>}
        {c._local && <span className="badge warn">Not synced</span>}
        {who && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: who.color, display: 'inline-block' }} />{who.name}</span>}
      </div>
      <div className="kv">
        {rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><div className="k">{k}</div><div className="v">{v}</div></div>)}
      </div>
      {c.notes && (
        <div className="section">
          <h3>Notes</h3>
          <div className="note" style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div>
        </div>
      )}
    </Sheet>
  );
}
