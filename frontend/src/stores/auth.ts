import { create } from "zustand";
import { persist } from "zustand/middleware";
import { configureAuth } from "@/lib/api";
import { authApi } from "@/services";
import type { User } from "@/types/api";

interface AuthState {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (email, password) => {
        const res = await authApi.login(email, password);
        set({ token: res.access_token, user: res.user });
      },
      register: async (fullName, email, password) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await authApi.register({ full_name: fullName, email, password, timezone });
        set({ token: res.access_token, user: res.user });
      },
      logout: () => set({ token: null, user: null }),
      refreshUser: async () => {
        const user = await authApi.me();
        set({ user });
      },
    }),
    // Only the session token + profile are kept client-side; all app data lives in PostgreSQL.
    { name: "focusflow-auth", partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
);

configureAuth(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().logout(),
);
