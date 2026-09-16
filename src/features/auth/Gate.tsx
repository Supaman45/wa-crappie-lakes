import { useState, type FormEvent } from 'react';
import { useAuth } from '@/store/auth';
import { Field } from '@/components/ui';

/**
 * wafishfinder.app is a public URL, so signup is closed behind an invite code. The code is
 * checked here for a fast, clear error, and again inside the signup transaction by a trigger on
 * auth.users, which is the check that actually counts.
 */
export function Gate() {
  const signIn = useAuth(s => s.signIn);
  const signUp = useAuth(s => s.signUp);
  const checkInvite = useAuth(s => s.checkInvite);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [invite, setInvite] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setHint('Enter a valid email.'); return; }
    if (pw.length < 6) { setHint('Password needs at least 6 characters.'); return; }
    if (mode === 'up' && !invite.trim()) { setHint('You need an invite code from Seri to create an account.'); return; }
    setBusy(true); setHint('');
    if (mode === 'up' && !(await checkInvite(invite))) {
      setBusy(false);
      setHint('That invite code is not valid, already used, or expired.');
      return;
    }
    const err = mode === 'in' ? await signIn(email.trim(), pw) : await signUp(email.trim(), pw, invite);
    setBusy(false);
    if (err) setHint(err);
  };

  return (
    <div className="gate">
      <div className="card">
        <h1>WA Fish Finder</h1>
        <div className="note" style={{ marginTop: 6 }}>
          {mode === 'in'
            ? 'Lakes, rivers, and surf across Washington. Sign in to see the crew log.'
            : 'Invite only. Enter the code you were given along with your email and a password.'}
        </div>
        <form className="form" onSubmit={submit}>
          <Field label="Email"><input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={e => setPw(e.target.value)} /></Field>
          {mode === 'up' && (
            <Field label="Invite code">
              <input
                className="input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="CREW-XXXXXX"
                value={invite}
                onChange={e => setInvite(e.target.value)}
              />
            </Field>
          )}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Working...' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button className="btn ghost" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setHint(''); }}>{mode === 'in' ? 'Have an invite code? Create an account' : 'Have an account? Sign in'}</button>
        </form>
        <div className="hint" aria-live="polite">{hint}</div>
      </div>
    </div>
  );
}
