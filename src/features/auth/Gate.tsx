import { useState, type FormEvent } from 'react';
import { useAuth } from '@/store/auth';
import { Field } from '@/components/ui';

export function Gate() {
  const signIn = useAuth(s => s.signIn); const signUp = useAuth(s => s.signUp);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [hint, setHint] = useState(''); const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setHint('Enter a valid email.'); return; }
    if (pw.length < 6) { setHint('Password needs at least 6 characters.'); return; }
    setBusy(true); setHint('');
    const err = mode === 'in' ? await signIn(email.trim(), pw) : await signUp(email.trim(), pw);
    setBusy(false);
    if (err) setHint(err);
  };

  return (
    <div className="gate">
      <div className="card">
        <h1>WA Fish Finder</h1>
        <div className="note" style={{ marginTop: 6 }}>Lakes, creeks, and surf across Washington. Sign in to see the crew log.</div>
        <form className="form" onSubmit={submit}>
          <Field label="Email"><input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={e => setPw(e.target.value)} /></Field>
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Working...' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button className="btn ghost" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setHint(''); }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
        </form>
        <div className="hint" aria-live="polite">{hint}</div>
      </div>
    </div>
  );
}
