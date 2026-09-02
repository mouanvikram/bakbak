import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  GetMeResponseType,
} from "@bakbak/contracts";
import {
  login as apiLogin,
  signup as apiSignup,
  verifyEmail as apiVerifyEmail,
  logout as apiLogout,
} from "./api";
import { getMe } from "@/features/users/api";
import { AuthContext } from "./auth-context";
import {
  clearTokens as clearStoredTokens,
  dedupeRefresh,
  getStoredTokens,
  storeTokens as storeStoredTokens,
} from "@/lib/api/tokens";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponseType["user"] | null>(null);
  const [profile, setProfile] = useState<GetMeResponseType["profile"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setUser(null);
      setProfile(null);
      return;
    }
    try {
      const me = await getMe();
      setProfile(me.profile);
      setUser({ id: me.profile.id, identifier: me.profile.username });
    } catch {
      setUser(null);
      setProfile(null);
      clearStoredTokens();
    }
  }, []);

  useEffect(() => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken || !refreshToken) {
      setIsLoading(false);
      return;
    }

    dedupeRefresh()
      .then(() => getMe())
      .then((me) => {
        setProfile(me.profile);
        setUser({ id: me.profile.id, identifier: me.profile.username });
      })
      .catch(() => {
        clearStoredTokens();
        setUser(null);
        setProfile(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (data: LoginRequestType) => {
    const response = await apiLogin(data);
    storeStoredTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
    const me = await getMe();
    setProfile(me.profile);
  }, []);

  const signup = useCallback(async (data: SignUpRequestType) => {
    await apiSignup(data);
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    await apiVerifyEmail(token);
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken } = getStoredTokens();
    try {
      await apiLogout({ refreshToken: refreshToken ?? undefined });
    } finally {
      clearStoredTokens();
      setUser(null);
      setProfile(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        verifyEmail,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
