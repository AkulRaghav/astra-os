/**
 * Global state management using Zustand.
 * Manages auth state, user profile, and real-time notification count.
 */

import { create } from "zustand";

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  plan: string;
  twoFactorEnabled: boolean;
  theme: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  unreadNotifications: number;
  setUser: (user: User | null) => void;
  setAuthenticated: (auth: boolean) => void;
  setLoading: (loading: boolean) => void;
  setUnreadNotifications: (count: number) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem("astra_token"),
  isLoading: true,
  unreadNotifications: 0,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoading: (isLoading) => set({ isLoading }),
  setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
  reset: () => set({ user: null, isAuthenticated: false, isLoading: false, unreadNotifications: 0 }),
}));
