import { useMemo, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { SWATCHES } from '@/data/species';
import { Sheet, Field } from '@/components/ui';

export function ProfileSheet() {
  const email = useAuth(s => s.email);
  const profiles = useData(s => s.profiles);
  const updateProfile = useData(s => s.updateProfile);
  const me = currentUserId();
  const current = me ? profiles[me] : undefined;
  const close = useUI.getState().closeSheet;

  const [name, setName] = useState(current?.name || (email || 'You').split('@')[0]);
  const [color, setColor] = useState(current?.color || '#eaa24c');
  const [busy, setBusy] = useState(false);

  const swatches = useMemo(() => {
    const cur = current?.color;
    return cur && !SWATCHES.includes(cur) ? [cur, ...SWATCHES] : SWATCHES.slice();
  }, [current?.color]);

  const trimmed = name.trim().slice(0, 24);
  const canSave = trimmed.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try { await updateProfile(trimmed, color); close(); }
    finally { setBusy(false); }
  };

  return (
    <Sheet title="Edit profile" sub={email || undefined} onClose={close}
      footer={<>
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!canSave} style={{ marginLeft: 'auto' }}>{busy ? 'Saving' : 'Save'}</button>
      </>}>
      <div className="form">
        <Field label="Name" full>
          <input className="input" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="nickname" />
        </Field>
        <Field label="Color" full>
          <div className="chips">
            {swatches.map(c => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: c === color ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: '0 0 0 1px var(--line)' }} />
            ))}
          </div>
        </Field>
        <div className="note full">Your name and color show on catches, visits, and lake tags your crew can see.</div>
      </div>
    </Sheet>
  );
}
