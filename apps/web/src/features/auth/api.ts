import type {
  LoginRequestType,
  LoginResponseType,
  SignUpRequestType,
  SignUpResponseType,
  AvatarUploadResponseType,
  ResendVerificationRequestType,
  ResendVerificationResponseType,
  ForgotPasswordRequestType,
  ForgotPasswordResponseType,
  ChangePasswordRequestType,
  ChangePasswordResponseType,
  RefreshTokenRequestType,
  RefreshTokenResponseType,
  LogoutRequestType,
  LogoutResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";

export function login(data: LoginRequestType): Promise<LoginResponseType> {
  return apiClient("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function signup(data: SignUpRequestType): Promise<SignUpResponseType> {
  return apiClient("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadAvatar(
  blob: Blob,
  fileName: string,
): Promise<AvatarUploadResponseType> {
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const res = await fetch("/api/v1/auth/avatar", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error?.message ?? body.message ?? `Upload failed (${res.status})`,
    );
  }

  return res.json();
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return apiClient(`/api/v1/auth/verify-email?token=${token}`, {
    method: "POST",
  });
}

export function resendVerification(
  data: ResendVerificationRequestType,
): Promise<ResendVerificationResponseType> {
  return apiClient("/api/v1/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function changePassword(
  data: ChangePasswordRequestType,
): Promise<ChangePasswordResponseType> {
  return apiClient("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function forgotPassword(
  data: ForgotPasswordRequestType,
): Promise<ForgotPasswordResponseType> {
  return apiClient("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function resetPassword(
  token: string,
  data: { newPassword: string },
): Promise<{ message: string }> {
  return apiClient(`/api/v1/auth/reset-password?token=${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function refreshToken(
  data: RefreshTokenRequestType,
): Promise<RefreshTokenResponseType> {
  return apiClient("/api/v1/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function logout(data?: LogoutRequestType): Promise<LogoutResponseType> {
  return apiClient("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}
