/**
 * Stub for useAuthStore - deprecated, use AuthContext instead
 * Kept for backwards compatibility only
 */

import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  role: 'fan',
  authStatus: 'idle',
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setRole: (role) => set({ role }),
}));

export default useAuthStore;
