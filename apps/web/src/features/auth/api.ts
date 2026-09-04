import type {
  LoginRequestType,
  LoginResponseType,
  LoginOutcomeType,
  VerifyTwoFactorLoginRequestType,
  ResendTwoFactorLoginRequestType,
  ResendTwoFactorLoginResponseType,
  EnableTwoFactorRequestType,
  SetupTwoFactorResponseType,
  TwoFactorStatusResponseType,
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
  ListSessionsResponseType,
  RevokeSessionResponseType,
} from "@bakbak/contracts";
import { apiClient } from "@/lib/api/client";
import { getRefreshToken } from "@/lib/api/tokens";

/** Resolves to tokens, or — when the account has 2FA on — a challenge that
 * must be replayed to `verifyTwoFactorLogin` with the emailed code. */
export function login(data: LoginRequestType): Promise<LoginOutcomeType> {
  return apiClient("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyTwoFactorLogin(
  data: VerifyTwoFactorLoginRequestType,
): Promise<LoginResponseType> {
  return apiClient("/api/v1/auth/login/verify-2fa", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function resendTwoFactorLogin(
  data: ResendTwoFactorLoginRequestType,
): Promise<ResendTwoFactorLoginResponseType> {
  return apiClient("/api/v1/auth/login/resend-2fa", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function setupTwoFactor(): Promise<SetupTwoFactorResponseType> {
  return apiClient("/api/v1/auth/2fa/setup", { method: "POST" });
}

export function enableTwoFactor(
  data: EnableTwoFactorRequestType,
): Promise<TwoFactorStatusResponseType> {
  return apiClient("/api/v1/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function disableTwoFactor(): Promise<TwoFactorStatusResponseType> {
  return apiClient("/api/v1/auth/2fa/disable", { method: "POST" });
}

// Refresh token is sent only as a fallback for identifying the current session.
export function listSessions(): Promise<ListSessionsResponseType> {
  return apiClient("/api/v1/auth/sessions", {
    method: "POST",
    body: JSON.stringify({ refreshToken: getRefreshToken() ?? undefined }),
  });
}

export function revokeSession(
  sessionId: string,
): Promise<RevokeSessionResponseType> {
  return apiClient("/api/v1/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function revokeOtherSessions(): Promise<RevokeSessionResponseType> {
  return apiClient("/api/v1/auth/sessions/revoke-others", {
    method: "POST",
    body: JSON.stringify({ refreshToken: getRefreshToken() ?? undefined }),
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
