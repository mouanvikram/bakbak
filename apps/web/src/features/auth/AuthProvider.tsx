import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  GetMeResponseType,
} from "@bakbak/contracts";
import {
  login as apiLogin,
  verifyTwoFactorLogin as apiVerifyTwoFactorLogin,
  signup as apiSignup,
  verifyEmail as apiVerifyEmail,
  logout as apiLogout,
} from "./api";
import { getMe, deleteMe } from "@/features/users/api";
import { AuthContext, type LoginResult } from "./auth-context";
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

  const startSession = useCallback(
    async (response: {
      accessToken: string;
      refreshToken: string;
      user: LoginResponseType["user"];
    }) => {
      storeStoredTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      const me = await getMe();
      setProfile(me.profile);
    },
    [],
  );

  const login = useCallback(
    async (data: LoginRequestType): Promise<LoginResult> => {
      const response = await apiLogin(data);
      if ("twoFactorRequired" in response) {
        return {
          twoFactorRequired: true,
          challengeId: response.challengeId,
        };
      }
      await startSession(response);
      return { twoFactorRequired: false };
    },
    [startSession],
  );

  const verifyTwoFactorLogin = useCallback(
    async (challengeId: string, code: string) => {
      const response = await apiVerifyTwoFactorLogin({ challengeId, code });
      await startSession(response);
    },
    [startSession],
  );

  const signup = useCallback(
    async (data: SignUpRequestType, avatar?: { blob: Blob; fileName: string }) => {
      await apiSignup(data, avatar);
    },
    [],
  );

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

  const deleteAccount = useCallback(async () => {
    await deleteMe();
    clearStoredTokens();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        login,
        verifyTwoFactorLogin,
        signup,
        verifyEmail,
        logout,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}