import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MeProfile } from "../types/api";

type AuthState = {
  token: string | null;
  userId: string | null;
  username: string | null;
  user: MeProfile | null;
  setSession: (payload: {
    token: string;
    userId: string;
    username?: string | null;
  }) => void;
  setUser: (user: MeProfile | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      username: null,
      user: null,
      setSession: ({ token, userId, username }) =>
        set({
          token,
          userId,
          username: username ?? null,
        }),
      setUser: (user) =>
        set({
          user,
          userId: user?.id ?? null,
          username: user?.username ?? null,
        }),
      logout: () =>
        set({
          token: null,
          userId: null,
          username: null,
          user: null,
        }),
    }),
    {
      name: "sealchat-auth",
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        username: state.username,
      }),
    },
  ),
);
