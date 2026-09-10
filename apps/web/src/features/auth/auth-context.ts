import { createContext, useContext } from "react";
import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  GetMeResponseType,
} from "@bakbak/contracts";

//login flow
export type LoginResult =
  | { twoFactorRequired: false }
  | { twoFactorRequired: true; challengeId: string }
  | {
      deleted: true;
      id: string;
      identifier: string;
      deletedAt: string;
      remainingMs: number;
    };

export interface AuthContextValue {
  user: LoginResponseType["user"] | null;
  profile: GetMeResponseType["profile"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequestType) => Promise<LoginResult>;
  verifyTwoFactorLogin: (challengeId: string, code: string) => Promise<void>;
  signup: (
    data: SignUpRequestType,
    avatar?: { blob: Blob; fileName: string },
  ) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string, twoFactorCode?: string) => Promise<void>;
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
