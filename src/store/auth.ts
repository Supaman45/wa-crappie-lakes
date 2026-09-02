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
  signUp: (email: string, password: string) => Promise<string | null>;
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

    const { data } = await sb.auth.getSession();
    const s = data.session;
    if (s) {
      set({ status: 'signed_in', session: s, userId: s.user.id, email: s.user.email ?? null });
      lsSet(HINT_KEY, JSON.stringify({ id: s.user.id, email: s.user.email }));
    } else if (hint && !navigator.onLine) {
      // keep optimistic offline state
    } else {
      set({ status: 'signed_out', session: null, userId: null, email: null });
    }
    sb.auth.onAuthStateChange((_evt, sess) => {
      if (sess) {
        set({ status: 'signed_in', session: sess, userId: sess.user.id, email: sess.user.email ?? null });
        lsSet(HINT_KEY, JSON.stringify({ id: sess.user.id, email: sess.user.email }));
      } else if (get().status !== 'booting') {
        set({ status: 'signed_out', session: null, userId: null, email: null });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },
  signUp: async (email, password) => {
    const { error, data } = await sb.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.session) return 'Check your email to confirm the account, then sign in.';
    return null;
  },
  signOut: async () => {
    // Pending outbox rows are kept; they flush on the next sign-in by the same user.
    await sb.auth.signOut();
    try { localStorage.removeItem(HINT_KEY); } catch { /* ignore */ }
    set({ status: 'signed_out', session: null, userId: null, email: null });
  },
}));
