import { createContext, useContext } from "react";
import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  GetMeResponseType,
} from "@bakbak/contracts";

export interface AuthContextValue {
  user: LoginResponseType["user"] | null;
  profile: GetMeResponseType["profile"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequestType) => Promise<void>;
  signup: (data: SignUpRequestType) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
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