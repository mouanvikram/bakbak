import type {
  LoginRequestType,
  LoginResponseType,
  LoginOutcomeType,
  VerifyTwoFactorLoginRequestType,
  ResendTwoFactorLoginRequestType,
  ResendTwoFactorLoginResponseType,
  EnableTwoFactorRequestType,
  DisableTwoFactorRequestType,
  SetupTwoFactorResponseType,
  TwoFactorStatusResponseType,
  SignUpRequestType,
SignUpResponseType,
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

export function disableTwoFactor(
  data: DisableTwoFactorRequestType,
): Promise<TwoFactorStatusResponseType> {
  return apiClient("/api/v1/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify(data),
  });
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

/**
 * Signs up, optionally carrying the avatar in the same request. The avatar is
 * only written once the signup is accepted, so nothing is stored server-side
 * for an abandoned signup.
 */
export function signup(
  data: SignUpRequestType,
  avatar?: { blob: Blob; fileName: string },
): Promise<SignUpResponseType> {
  if (!avatar) {
    return apiClient("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }
  formData.append("file", avatar.blob, avatar.fileName);

  return apiClient("/api/v1/auth/signup", {
    method: "POST",
    body: formData,
  });
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return apiClient("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
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
  return apiClient("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ ...data, token }),
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
