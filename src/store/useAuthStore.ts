/**
 * Auth Store — Hexora
 * Supports two auth modes:
 *   1. Firebase (Google OAuth / email) — when VITE_FIREBASE_API_KEY is set
 *   2. Local backend (email/password) — works without Firebase, ideal for corporate
 */

import { create } from 'zustand';
import { setToken, clearToken, getToken } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Firebase is optional — only loaded if configured
const FIREBASE_ENABLED = !!import.meta.env.VITE_FIREBASE_API_KEY;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photo?: string;
}

interface AuthState {
  user: AuthUser | null;
  initializing: boolean;
  firebaseEnabled: boolean;
  loginWithGoogle: () => Promise<void>;
  login:    (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
  /** Chamado uma vez no mount do App — observa mudanças de sessão */
  initAuth: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:        null,
  initializing: true,
  firebaseEnabled: FIREBASE_ENABLED,

  initAuth: () => {
    if (FIREBASE_ENABLED) {
      // ── Firebase mode ──────────────────────────────────────────────
      return initFirebaseAuth(set);
    }

    // ── Local mode — check if we have a stored JWT ────────────────
    const token = getToken();
    if (token) {
      // Validate token with backend
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          set({ user: { id: data.id, name: data.name, email: data.email }, initializing: false });
        })
        .catch(() => {
          clearToken();
          set({ user: null, initializing: false });
        });
    } else {
      set({ initializing: false });
    }
    return () => {}; // no cleanup needed
  },

  loginWithGoogle: async () => {
    if (!FIREBASE_ENABLED) throw new Error('Google login nao disponivel sem Firebase.');
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    const { auth } = await import('../lib/firebase');
    if (!auth) throw new Error('Firebase Auth nao inicializado.');
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const u = result.user;
    set({
      user: {
        id: u.uid,
        name: u.displayName ?? u.email?.split('@')[0] ?? 'Usuario',
        email: u.email ?? '',
        photo: u.photoURL ?? undefined,
      },
    });
  },

  login: async (email, password) => {
    if (FIREBASE_ENABLED) {
      // Firebase email/password + backend sync
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      if (!auth) throw new Error('Firebase Auth nao inicializado.');
      const result = await signInWithEmailAndPassword(auth, email, password);
      const u = result.user;
      set({
        user: {
          id: u.uid,
          name: u.displayName ?? u.email?.split('@')[0] ?? 'Usuario',
          email: u.email ?? '',
          photo: u.photoURL ?? undefined,
        },
      });
      return;
    }

    // ── Local backend login ──────────────────────────────────────
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro ao fazer login' }));
      throw new Error(err.detail ?? 'Email ou senha invalidos');
    }
    const data = await res.json();
    setToken(data.access_token);

    // Fetch user profile
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      set({ user: { id: me.id, name: me.name, email: me.email } });
    }
  },

  register: async (name, email, password) => {
    if (FIREBASE_ENABLED) {
      // Firebase register + backend sync
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      if (!auth) throw new Error('Firebase Auth nao inicializado.');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      set({
        user: {
          id: result.user.uid,
          name,
          email: result.user.email ?? '',
        },
      });
      return;
    }

    // ── Local backend register ───────────────────────────────────
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro ao cadastrar' }));
      throw new Error(err.detail ?? 'Erro ao criar conta');
    }
    const data = await res.json();
    setToken(data.access_token);

    // Fetch user profile
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      set({ user: { id: me.id, name: me.name, email: me.email } });
    }
  },

  logout: async () => {
    if (FIREBASE_ENABLED) {
      try {
        const { signOut } = await import('firebase/auth');
        const { auth } = await import('../lib/firebase');
        if (auth) await signOut(auth);
      } catch { /* ignore if firebase not loaded */ }
    }
    clearToken();
    set({ user: null });
  },
}));


// ── Firebase auth listener (only used when Firebase is configured) ────────────

function initFirebaseAuth(set: (s: Partial<AuthState>) => void): () => void {
  // Dynamic import to avoid loading firebase when not needed
  let unsub = () => {};

  import('firebase/auth').then(({ onAuthStateChanged }) => {
    import('../lib/firebase').then(({ auth }) => {
      if (!auth) { set({ initializing: false }); return; }
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          set({
            user: {
              id: firebaseUser.uid,
              name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Usuario',
              email: firebaseUser.email ?? '',
              photo: firebaseUser.photoURL ?? undefined,
            },
            initializing: false,
          });
          // Sync with backend — get JWT
          try {
            const res = await fetch(`${API_BASE}/auth/firebase-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firebase_uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              }),
            });
            if (res.ok) {
              const data = await res.json();
              setToken(data.access_token);
            }
          } catch { /* backend offline */ }
        } else {
          set({ user: null, initializing: false });
          clearToken();
        }
      });
    });
  }).catch(() => {
    set({ initializing: false });
  });

  return () => unsub();
}
