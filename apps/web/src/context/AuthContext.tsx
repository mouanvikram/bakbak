import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
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
  refreshToken as apiRefreshToken,
  logout as apiLogout,
} from "@/api/auth.api";
import { getMe } from "@/api/user.api";

interface AuthState {
  user: LoginResponseType["user"] | null;
  profile: GetMeResponseType["profile"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequestType) => Promise<void>;
  signup: (data: SignUpRequestType) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_TOKEN_KEY = "bakbak_access_token";
const REFRESH_TOKEN_KEY = "bakbak_refresh_token";

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

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
      clearTokens();
    }
  }, []);

  useEffect(() => {
    const { accessToken, refreshToken } = getStoredTokens();
    if (!accessToken || !refreshToken) {
      setIsLoading(false);
      return;
    }

    apiRefreshToken({ refreshToken })
      .then((tokens) => {
        storeTokens(tokens.accessToken, tokens.refreshToken);
        return getMe();
      })
      .then((me) => {
        setProfile(me.profile);
        setUser({ id: me.profile.id, identifier: me.profile.username });
      })
      .catch(() => {
        clearTokens();
        setUser(null);
        setProfile(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (data: LoginRequestType) => {
    const response = await apiLogin(data);
    storeTokens(response.accessToken, response.refreshToken);
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
      clearTokens();
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
