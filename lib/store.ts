import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
}

interface AppState {
  user: User | null;
  token: string | null;
  _hydrated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  logout: () => void;
  hydrate: () => void;
}

function getInitialUser(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const token = localStorage.getItem('token');
    if (!token) return { user: null, token: null };
    const t = JSON.parse(atob(token.split('.')[1]));
    return {
      user: { id: t.userId, username: t.username, role: t.role },
      token,
    };
  } catch {
    return { user: null, token: null };
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  _hydrated: false,
  setAuth: (user, token) => {
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
    set({ user, token });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  hydrate: () => {
    if (get()._hydrated) return;
    const { user, token } = getInitialUser();
    set({ user, token, _hydrated: true });
  },
}));
