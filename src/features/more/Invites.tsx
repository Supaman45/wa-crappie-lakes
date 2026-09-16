import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { Empty, Icon } from '@/components/ui';
import { toast } from '@/lib/toast';

export interface InviteCode {
  code: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  revoked: boolean;
  used_by: string[];
}

const WORDS = ['RIVER', 'COAST', 'CREEK', 'TIDE', 'DRIFT', 'GRAVEL', 'SLACK', 'RIFFLE', 'SPEY', 'CHUM'];

/** Readable enough to text, random enough not to guess. */
function makeCode(): string {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let tail = '';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (const n of buf) tail += chars[n % chars.length];
  return `${w}-${tail}`;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function status(c: InviteCode): { label: string; cls: string } {
  const d = daysLeft(c.expires_at);
  if (c.revoked) return { label: 'Revoked', cls: 'hot' };
  if (c.uses >= c.max_uses) return { label: 'Used up', cls: '' };
  if (d != null && d <= 0) return { label: 'Expired', cls: 'hot' };
  if (d != null && d <= 7) return { label: `${d}d left`, cls: 'warn' };
  return { label: `${c.max_uses - c.uses} left`, cls: 'ok' };
}

/**
 * Who gets into the crew.
 *
 * The app is on a public URL now, so an account needs a code. One code per friend keeps the
 * audit trail readable: you can see who redeemed what, and killing a code is one tap.
 */
export function Invites() {
  const userId = useAuth(s => s.userId);
  const [rows, setRows] = useState<InviteCode[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await sb
      .from('invite_codes')
      .select('code,label,created_at,expires_at,max_uses,uses,revoked,used_by')
      .order('created_at', { ascending: false });
    if (error) { setErr(error.message); setRows([]); return; }
    setErr('');
    setRows((data || []) as InviteCode[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!userId || busy) return;
    setBusy(true);
    const row = {
      code: makeCode(),
      label: label.trim() || null,
      created_by: userId,
      max_uses: 1,
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    };
    const { error } = await sb.from('invite_codes').insert(row);
    setBusy(false);
    if (error) { toast('Could not create the code: ' + error.message, 'err'); return; }
    setLabel('');
    await load();
    share(row.code, row.label);
  };

  const revoke = async (code: string) => {
    if (!confirm(`Kill ${code}? Anyone holding it stops being able to sign up.`)) return;
    const { error } = await sb.from('invite_codes').update({ revoked: true }).eq('code', code);
    if (error) { toast('Could not revoke: ' + error.message, 'err'); return; }
    load();
  };

  const share = async (code: string, who?: string | null) => {
    const text = `${who ? who + ', here' : 'Here'} is your invite to WA Fish Finder.\n\nhttps://wafishfinder.app\nCode: ${code}\n\nCreate an account with that code, then add it to your home screen.`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('Invite copied, paste it to them');
    } catch { /* the user cancelled the share sheet */ }
  };

  if (!userId) return null;

  return (
    <div className="section">
      <h3>Invites <small>who gets into the crew</small></h3>
      <div className="note" style={{ paddingBottom: 8 }}>
        wafishfinder.app is public, so an account needs a code. Make one per friend, send it, and
        revoke it if it goes astray. Codes last 90 days and are good for one signup.
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <input
          className="input"
          placeholder="Who is it for? e.g. Zaki"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') create(); }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="button" className="btn primary" onClick={create} disabled={busy}>
          <Icon name="plus" size={16} />{busy ? 'Making' : 'New code'}
        </button>
      </div>

      {err && <div className="note" style={{ color: 'var(--red)' }}>Could not load your codes: {err}</div>}
      {rows === null && <div className="note"><span className="spinner" /> Loading</div>}
      {rows && !rows.length && <Empty>No codes yet. Make one and send it to whoever you want in.</Empty>}

      <div className="list">
        {(rows || []).map(c => {
          const st = status(c);
          const dead = c.revoked || c.uses >= c.max_uses || (daysLeft(c.expires_at) ?? 1) <= 0;
          return (
            <div key={c.code} className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', opacity: dead ? .55 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14 }}>{c.code}</div>
                    <div className="sub">{c.label || 'No name'}{c.used_by?.length ? ` · used by ${c.used_by.join(', ')}` : ''}</div>
                  </div>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </div>
                {!dead && (
                  <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" className="btn sm" onClick={() => share(c.code, c.label)}><Icon name="share" size={14} />Send</button>
                    <button type="button" className="btn sm ghost" onClick={() => revoke(c.code)}><Icon name="trash" size={14} />Revoke</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
