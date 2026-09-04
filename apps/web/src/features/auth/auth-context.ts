import { createContext, useContext } from "react";
import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  GetMeResponseType,
} from "@bakbak/contracts";

/** What `login` reports back: either the session is live, or a 2FA code was
 * emailed and `challengeId` must go to `verifyTwoFactorLogin`. */
export type LoginResult =
  | { twoFactorRequired: false }
  | { twoFactorRequired: true; challengeId: string };

export interface AuthContextValue {
  user: LoginResponseType["user"] | null;
  profile: GetMeResponseType["profile"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequestType) => Promise<LoginResult>;
  verifyTwoFactorLogin: (challengeId: string, code: string) => Promise<void>;
  signup: (data: SignUpRequestType) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}