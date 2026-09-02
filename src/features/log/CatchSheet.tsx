import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Sheet, Field, Icon } from '@/components/ui';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { LAKE_SPECIES, CREEK_SPECIES, BAITS, STRUCTURE, spById } from '@/data/species';
import { todayStr, lsGet, lsSet } from '@/lib/util';
import { toast } from '@/lib/toast';
import type { Catch, WaterType } from '@/lib/types';

const LS_SPECIES = 'wff-lastsp';
const LS_BAIT = 'wff-lastbait';

function num(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function CatchSheet({ lakeId, lakeName, waterType, spotId }: { lakeId: string; lakeName: string; waterType: WaterType; spotId: string | null }) {
  const closeSheet = useUI(s => s.closeSheet);
  const saveCatch = useData(s => s.saveCatch);
  const logVisit = useData(s => s.logVisit);

  const speciesList = useMemo<string[]>(() => waterType === 'lake' ? [...LAKE_SPECIES] : [...CREEK_SPECIES, 'other'], [waterType]);

  const [species, setSpecies] = useState<string>(() => {
    const last = lsGet(LS_SPECIES);
    return last && speciesList.includes(last) ? last : speciesList[0];
  });
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState('1');
  const [length, setLength] = useState('');
  const [weight, setWeight] = useState('');
  const [depth, setDepth] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [bait, setBait] = useState<string>(() => {
    const last = lsGet(LS_BAIT);
    return last && BAITS.includes(last) ? last : '';
  });
  const [structure, setStructure] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Object URL for the preview; revoke when it changes or the sheet unmounts.
  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    setPhoto(f || null);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const row: Partial<Catch> & { lake_id: string } = {
        lake_id: lakeId,
        lake_name: lakeName,
        species,
        date: date || todayStr(),
        qty: Math.max(1, parseInt(qty, 10) || 1),
        length: num(length),
        weight: num(weight),
        depth: num(depth),
        water_temp: num(waterTemp),
        bait: bait || null,
        structure: structure || null,
        notes: notes.trim() || null,
        water_type: waterType,
        spot_id: spotId,
      };
      lsSet(LS_SPECIES, species);
      if (bait) lsSet(LS_BAIT, bait);
      await saveCatch(row, photo);
      // A catch implies a visit that day.
      await logVisit(lakeId, lakeName, waterType, spotId, row.date);
      toast('Catch saved');
      closeSheet();
    } catch (e) {
      toast(String((e as Error)?.message || e || 'Catch did not save'), 'err');
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Log a catch"
      sub={lakeName}
      onClose={closeSheet}
      footer={<>
        <button type="button" className="btn ghost" onClick={closeSheet} disabled={saving}>Cancel</button>
        <button type="button" className="btn primary" onClick={save} disabled={saving} style={{ marginLeft: 'auto' }}>
          {saving ? <span className="spinner" /> : <Icon name="check" />}{saving ? 'Saving' : 'Save catch'}
        </button>
      </>}
    >
      <div className="form">
        <Field label="Species">
          <select className="select" value={species} onChange={e => setSpecies(e.target.value)}>
            {speciesList.map(id => <option key={id} value={id}>{spById[id]?.name || id}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="How many">
          <input className="input" type="number" inputMode="numeric" min={1} step={1} value={qty} onChange={e => setQty(e.target.value)} />
        </Field>
        <Field label="Length (in)">
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="11.5" value={length} onChange={e => setLength(e.target.value)} />
        </Field>
        <Field label="Weight (lb)">
          <input className="input" type="number" inputMode="decimal" step="0.01" placeholder="optional" value={weight} onChange={e => setWeight(e.target.value)} />
        </Field>
        <Field label="Depth (ft)">
          <input className="input" type="number" inputMode="decimal" step="0.5" placeholder="optional" value={depth} onChange={e => setDepth(e.target.value)} />
        </Field>
        <Field label="Water temp (F)">
          <input className="input" type="number" inputMode="decimal" step="1" placeholder="optional" value={waterTemp} onChange={e => setWaterTemp(e.target.value)} />
        </Field>
        <Field label="Bait">
          <select className="select" value={bait} onChange={e => setBait(e.target.value)}>
            <option value="">Not set</option>
            {BAITS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Structure">
          <select className="select" value={structure} onChange={e => setStructure(e.target.value)}>
            <option value="">Not set</option>
            {STRUCTURE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea className="input" rows={2} placeholder="Color, presentation, weather" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
        <Field label="Photo" full>
          <label className="photo-drop">
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
            {preview
              ? <img src={preview} alt="Catch photo preview" />
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="camera" size={16} />Add photo</span>}
            {preview && <div className="note" style={{ marginTop: 6 }}>Tap to change</div>}
          </label>
        </Field>
      </div>
    </Sheet>
  );
}
