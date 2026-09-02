import { useEffect, useMemo, useState } from 'react';
import type { Spot, SpotAccess, SpotStatus } from '@/lib/types';
import { speciesColor, speciesLabel } from '@/data/species';
import { dirUrl, fmtDate } from '@/lib/util';
import { toast } from '@/lib/toast';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { Sheet, Icon, Field, Score, Empty, Chip } from '@/components/ui';
import { SPOT_STATUS, ACCESS_LABEL, PriorityDots, SpeciesBadges } from '@/features/creeks/CreeksPanel';

const KIND_LABEL: Record<string, string> = { creek: 'Creek', river: 'River', lake: 'Lake', salt: 'Saltwater' };

export function SpotSheet({ spot: propSpot }: { spot: Spot }) {
  const closeSheet = useUI(s => s.closeSheet);
  const openSheet = useUI(s => s.openSheet);
  const fly = useUI(s => s.fly);
  const spots = useData(s => s.spots);
  const catches = useData(s => s.catches);
  const index = useData(s => s.index);
  const profiles = useData(s => s.profiles);
  const updateSpot = useData(s => s.updateSpot);
  const deleteSpot = useData(s => s.deleteSpot);
  const logVisit = useData(s => s.logVisit);

  const spot = useMemo(() => spots.find(s => s.id === propSpot.id) || propSpot, [spots, propSpot]);
  const me = currentUserId();
  const mine = !!me && spot.user_id === me;
  const owner = !mine ? (profiles[spot.user_id]?.name || 'Crew member') : null;

  const [name, setName] = useState(spot.name);
  const [status, setStatus] = useState<SpotStatus>(spot.status);
  const [priority, setPriority] = useState(spot.priority);
  const [access, setAccess] = useState<SpotAccess>(spot.access);
  const [permit, setPermit] = useState(spot.permit || '');
  const [notes, setNotes] = useState(spot.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-seed the form when a different spot opens in the same mounted sheet.
  useEffect(() => {
    setName(spot.name); setStatus(spot.status); setPriority(spot.priority); setAccess(spot.access); setPermit(spot.permit || ''); setNotes(spot.notes || '');
    setConfirmDelete(false);
  }, [spot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = mine && (name.trim() !== spot.name || status !== spot.status || priority !== spot.priority || access !== spot.access || (permit.trim() || null) !== (spot.permit || null) || (notes.trim() || null) !== (spot.notes || null));

  const stats = index[spot.id];
  const recent = useMemo(() => catches.filter(c => c.lake_id === spot.id || c.spot_id === spot.id).slice(0, 8), [catches, spot.id]);

  const meta = spot.meta || {};
  const metaScore = typeof meta.score === 'number' ? meta.score : null;
  const metaWhy = typeof meta.why === 'string' ? meta.why : null;

  async function save() {
    if (!mine || saving) return;
    const nm = name.trim();
    if (!nm) { toast('Give the spot a name', 'warn'); return; }
    setSaving(true);
    try {
      await updateSpot(spot.id, { name: nm, status, priority, access, permit: permit.trim() || null, notes: notes.trim() || null });
      toast('Spot updated');
    } catch (e) { toast((e as Error).message || 'Could not update the spot', 'err'); }
    finally { setSaving(false); }
  }

  async function visit() {
    const ok = await logVisit(spot.id, spot.name, spot.kind, spot.id);
    toast(ok ? `Visit logged at ${spot.name}` : 'Already logged a visit here today', ok ? 'info' : 'warn');
  }

  async function doDelete() {
    if (!mine) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try { await deleteSpot(spot.id); toast('Spot deleted'); closeSheet(); }
    catch (e) { toast((e as Error).message || 'Could not delete the spot', 'err'); }
    finally { setDeleting(false); }
  }

  const sub = `${KIND_LABEL[spot.kind] || spot.kind} · ${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}${owner ? ` · ${owner}` : ''}`;

  const footer = (
    <>
      <button type="button" className="btn primary" onClick={visit}><Icon name="check" />Log visit</button>
      <button type="button" className="btn" onClick={() => openSheet({ kind: 'catch', lakeId: spot.id, lakeName: spot.name, waterType: spot.kind, spotId: spot.id })}><Icon name="plus" />Log catch</button>
      <a className="btn" href={dirUrl(spot.lat, spot.lng)} target="_blank" rel="noopener"><Icon name="nav" />Directions</a>
      <button type="button" className="btn" onClick={() => { fly(spot.lat, spot.lng, 14); closeSheet(); }}><Icon name="locate" />Center map</button>
      {mine && (
        <button type="button" className="btn danger ghost" onClick={doDelete} disabled={deleting}><Icon name="trash" />{confirmDelete ? 'Confirm delete' : 'Delete'}</button>
      )}
    </>
  );

  return (
    <Sheet title={spot.name} sub={sub} onClose={closeSheet} footer={footer}>
      {/* Score and species */}
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        {metaScore != null && <Score n={metaScore} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {metaScore != null && <div className="pname">Creek Score{metaWhy ? '' : ' when saved'}</div>}
          {metaWhy && <div className="pwhy">{metaWhy}</div>}
          <div style={{ marginTop: metaScore != null ? 6 : 0, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <SpeciesBadges ids={spot.species} />
            {spot.species.length === 0 && <span className="note">No species recorded</span>}
          </div>
          {spot.llid && <div className="note" style={{ marginTop: 4 }}>LLID {spot.llid}</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="section">
        <h3>At this spot</h3>
        <div className="stat-grid">
          <div className="stat"><div className="n">{stats?.visits ?? 0}</div><div className="l">Visits</div></div>
          <div className="stat"><div className="n">{stats?.catches ?? 0}</div><div className="l">Catches</div></div>
          <div className="stat"><div className="n" style={{ fontSize: 16 }}>{stats?.lastDate ? fmtDate(stats.lastDate) : 'none'}</div><div className="l">Last</div></div>
        </div>
      </div>

      {/* Details: editable for the owner, read-only for crew */}
      <div className="section">
        <h3>Details {mine && dirty && <small>unsaved changes</small>}</h3>
        {mine ? (
          <div className="form">
            <Field label="Name" full><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={80} /></Field>
            <Field label="Status" full>
              <div className="chips">
                {SPOT_STATUS.map(s => <Chip key={s.id} on={status === s.id} color={s.color} onClick={() => setStatus(s.id)}>{s.label}</Chip>)}
              </div>
            </Field>
            <Field label="Priority" full>
              <div className="chips">
                {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className={`chip${priority === n ? ' on' : ''}`} aria-pressed={priority === n} onClick={() => setPriority(n)}>{n}</button>)}
              </div>
            </Field>
            <Field label="Access">
              <select className="select" value={access} onChange={e => setAccess(e.target.value as SpotAccess)}>
                <option value="public">Public</option>
                <option value="timber">Timber permit</option>
                <option value="private">Private</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="Permit"><input className="input" value={permit} onChange={e => setPermit(e.target.value)} placeholder="Permit name, if any" maxLength={80} /></Field>
            <Field label="Notes" full><textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="How to get there, what to try" /></Field>
            <div className="full row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn primary" onClick={save} disabled={!dirty || saving}><Icon name="check" />{saving ? 'Saving' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <div className="kv">
            <span className="k">Status</span><span className="v" style={{ color: SPOT_STATUS.find(x => x.id === spot.status)?.color }}>{SPOT_STATUS.find(x => x.id === spot.status)?.label || spot.status}</span>
            <span className="k">Priority</span><span className="v"><PriorityDots n={spot.priority} /></span>
            <span className="k">Access</span><span className="v">{ACCESS_LABEL[spot.access] || spot.access}</span>
            <span className="k">Permit</span><span className="v">{spot.permit || 'none'}</span>
            {spot.notes && <><span className="k">Notes</span><span className="v" style={{ fontWeight: 400, textAlign: 'left', gridColumn: '1 / -1', whiteSpace: 'pre-wrap' }}>{spot.notes}</span></>}
          </div>
        )}
      </div>

      {/* Recent catches */}
      <div className="section">
        <h3>Recent catches <small>{recent.length}</small></h3>
        {recent.length === 0 ? <Empty>No catches logged here yet.</Empty> : (
          <div className="list">
            {recent.map(c => {
              const who = profiles[c.user_id];
              return (
                <div key={c.id} className="item" role="button" tabIndex={0} onClick={() => openSheet({ kind: 'catchView', catchId: c.id })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet({ kind: 'catchView', catchId: c.id }); } }}>
                  <span className="pin" style={{ background: speciesColor(c.species) }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{c.qty > 1 ? `${c.qty} ` : ''}{speciesLabel(c.species)}{c.length != null ? `, ${c.length} in` : ''}</div>
                    <div className="sub">{fmtDate(c.date)}{who && c.user_id !== me ? ` · ${who.name}` : ''}{c.bait ? ` · ${c.bait}` : ''}</div>
                  </div>
                  <div className="right">{c.photo_path ? <Icon name="camera" size={16} /> : null}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
