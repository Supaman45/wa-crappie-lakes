import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { sb } from '@/lib/supabase';
import { lsGet, lsSet } from '@/lib/util';

export type AuthStatus = 'booting' | 'signed_out' | 'signed_in';

interface AuthHint { id: string; email: string; }

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  userId: string | null;
  email: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, invite: string) => Promise<string | null>;
  checkInvite: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const HINT_KEY = 'wff-acct';

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  session: null,
  userId: null,
  email: null,

  init: async () => {
    // Optimistic hint lets the app render cached data offline while the session is verified.
    const hintRaw = lsGet(HINT_KEY);
    const hint: AuthHint | null = hintRaw ? (() => { try { return JSON.parse(hintRaw); } catch { return null; } })() : null;
    if (hint && !navigator.onLine) set({ status: 'signed_in', userId: hint.id, email: hint.email });

    // getSession can stall on some phones (browser lock API, stale service worker). Never sit on a dark screen.
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 7000));
    const got = await Promise.race([sb.auth.getSession().then(r => r.data.session).catch(() => null), timeout]);
    const s = got;
    if (s) {
      set({ status: 'signed_in', session: s, userId: s.user.id, email: s.user.email ?? null });
      lsSet(HINT_KEY, JSON.stringify({ id: s.user.id, email: s.user.email }));
    } else if (hint && !navigator.onLine) {
      // keep optimistic offline state
    } else if (hint && got === null) {
      // Timed out or offline with a remembered account: open on cached data, a fresh session arrives via onAuthStateChange.
      set({ status: 'signed_in', userId: hint.id, email: hint.email });
    } else {
      set({ status: 'signed_out', session: null, userId: null, email: null });
    }
    sb.auth.onAuthStateChange((_evt, sess) => {
      if (sess) {
        set({ status: 'signed_in', session: sess, userId: sess.user.id, email: sess.user.email ?? null });
        lsSet(HINT_KEY, JSON.stringify({ id: sess.user.id, email: sess.user.email }));
      } else if (get().status !== 'booting' && (navigator.onLine || !lsGet(HINT_KEY))) {
        // Offline with a remembered account: keep the optimistic session so cached data stays usable.
        set({ status: 'signed_out', session: null, userId: null, email: null });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },
  /**
   * The invite code rides in user metadata. A trigger on auth.users validates and consumes it
   * inside the signup transaction, so the account cannot exist without a live code. The client
   * check in the Gate is only there to give a decent error before the round trip.
   */
  signUp: async (email, password, invite) => {
    const code = (invite || '').trim();
    if (!code) return 'An invite code is required.';
    const { error, data } = await sb.auth.signUp({ email, password, options: { data: { invite: code } } });
    if (error) return /invite|42501|not valid|required/i.test(error.message)
      ? 'That invite code is not valid, already used, or expired.'
      : error.message;
    if (!data.session) return 'Check your email to confirm the account, then sign in.';
    return null;
  },
  /** UX only. The database decides. */
  checkInvite: async (code) => {
    const { data, error } = await sb.rpc('invite_is_valid', { p_code: code.trim() });
    return error ? true : !!data;   // on a network error let the signup attempt be the judge
  },
  signOut: async () => {
    // Pending outbox rows are kept; they flush on the next sign-in by the same user.
    await sb.auth.signOut();
    try { localStorage.removeItem(HINT_KEY); } catch { /* ignore */ }
    set({ status: 'signed_out', session: null, userId: null, email: null });
  },
}));
