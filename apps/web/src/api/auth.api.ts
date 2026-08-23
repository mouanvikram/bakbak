import { apiClient } from "./client";

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    identifier: string;
  };
}

export function login(data: LoginRequest): Promise<LoginResponse> {
  return apiClient("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface SignupRequest {
  firstname: string;
  lastname: string;
  displayName: string;
  username: string;
  email: string;
  password: string;
  bio?: string;
  avatarUrl?: string;
}
export interface SignupResponse {
  status: string;
}

export function signup(data: SignupRequest): Promise<SignupResponse> {
  return apiClient("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface EmailVerification {
  token: string;
}

export interface verifyEmailResponse extends Response {}

export function verifyEmail(token: string): Promise<verifyEmailResponse> {
  return apiClient(`/api/v1/auth/verify-email?token=${token}`, { method: "POST" });
}
