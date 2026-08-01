import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
  avatar?: string | null; // 用户头像（emoji 或图片 URL）
}

interface AppState {
  user: User | null;
  token: string | null;
  _hydrated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  logout: () => void;
  hydrate: () => void;
  updateAvatar: (avatar: string | null) => void; // 单独更新头像
}

function getInitialUser(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const token = localStorage.getItem('token');
    if (!token) return { user: null, token: null };
    const t = JSON.parse(atob(token.split('.')[1]));
    return {
      // JWT payload 中不包含 avatar，初始为 null
      user: { id: t.userId, username: t.username, role: t.role, avatar: null },
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
  // 单独更新头像，保留其它用户字段
  updateAvatar: (avatar) => {
    set((state) => ({
      user: state.user ? { ...state.user, avatar } : state.user,
    }));
  },
}));
