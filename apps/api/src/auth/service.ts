import type { AccessTokenPayload, JwtService } from "./jwt.service";
import type { PasswordService } from "./password.service";
import type { UserRepository } from "@/users/repository";
import type { EmailService } from "@/email/service";
import crypto from "crypto";
import type { EmailRepository } from "@/email/repository";
import type { RefreshTokenRepository } from "./refresh-token.repository";
import type { SettingsRepository } from "@/settings/repository";
import { disconnectSockets } from "@/websocket/emitter";
import { VerificationTokenType } from "@bakbak/db";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { authConfig } from "./config";
import logger from "@/lib/logger";
import type {
  ChangePasswordRequestType,
  ChangePasswordResponseType,
  ForgotPasswordRequestType,
  ForgotPasswordResponseType,
  LoginRequestType,
  LoginResponseType,
  ResendVerificationRequestType,
  ResendVerificationResponseType,
  ResetPasswordRequestType,
  ResetPasswordResponseType,
  RecoverAccountRequestType,
  RecoverAccountResponseType,
  VerifyRecoveryRequestType,
  VerifyRecoveryResponseType,
  SignUpRequestType,
  SignUpResponseType,
  VerifyEmailRequestType,
  VerifyEmailResponseType,
  RefreshTokenRequestType,
  RefreshTokenResponseType,
  LogoutResponseType,
  LoginOutcomeType,
  VerifyTwoFactorLoginRequestType,
  ResendTwoFactorLoginRequestType,
  ResendTwoFactorLoginResponseType,
  EnableTwoFactorRequestType,
  DisableTwoFactorRequestType,
  TwoFactorStatusResponseType,
  SetupTwoFactorResponseType,
  ListSessionsResponseType,
  RevokeSessionResponseType,
} from "@bakbak/contracts";
import type { StorageProvider } from "@/uploads/storage.provider";
import type { UploadRepository } from "@/uploads/repository";
import type { UploadFile } from "@bakbak/contracts";
import { titleCaseName } from "@/lib/name-case";
import {
  extensionFrom,
  kindFromExtension,
  kindFromMime,
} from "@/uploads/file-type";

interface TwoFactorChallengePayload {
  sub: string;
  purpose: "login_2fa";
}

// The fields every outgoing account email needs: address, greeting, log id.
interface EmailRecipient {
  id: string;
  email: string;
  username: string;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly emailRepository: EmailRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly storageProvider: StorageProvider,
    private readonly uploadRepository: UploadRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  // Writes the avatar uploaded alongside signup to object storage + the
  // database, returning its storage key.
  private async resolveAvatar(
    file: UploadFile | undefined,
  ): Promise<string | null> {
    if (!file) return null;

    try {
      const key = this.buildAvatarKey(file.originalname);
      await this.storageProvider.upload(key, file.buffer, file.mimetype);

      await this.uploadRepository.create({
        kind:
          kindFromMime(file.mimetype) ??
          kindFromExtension(extensionFrom(file.originalname)),
        fileName: file.originalname,
        filePath: key,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      return key;
    } catch (error) {
      logger.error(
        { err: error, fileName: file.originalname },
        "Failed to persist avatar on signup",
      );
      return null;
    }
  }
  private buildAvatarKey(originalName: string): string {
    const ext = extensionFrom(originalName);
    const uuid = crypto.randomUUID();
    return `avatars/${uuid}${ext ? `.${ext}` : ""}`;
  }

  private hashToken(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async register(
    dto: SignUpRequestType,
    avatarFile?: UploadFile,
  ): Promise<SignUpResponseType> {
    const userExists = await this.userRepository.findFirst({
      OR: [{ username: dto.username }, { email: dto.email }],
    });

    if (userExists) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.ACCOUNT_ALREADY_EXISTS,
        "Username or email already in use",
      );
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const avatarUrl =
      (await this.resolveAvatar(avatarFile)) ?? dto.avatarUrl ?? null;

    const token = this.generateToken();
    const hashedToken = this.hashToken(token);

    const user = await this.userRepository.create({
      username: dto.username,
      email: dto.email,
      passwordHash: hashedPassword,
      profile: {
        create: {
          firstName: titleCaseName(dto.firstname),
          lastName: titleCaseName(dto.lastname),
          avatar: avatarUrl,
          displayName: titleCaseName(dto.displayname),
          bio: dto.bio,
        },
      },
      verification: {
        create: {
          tokenHash: hashedToken,
          type: VerificationTokenType.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + authConfig.verificationTokenTtlMs),
        },
      },
    });

    await this.sendVerificationEmail(user, token);

    return {
      message: "Verification email sent successfully",
    } as SignUpResponseType;
  }

  async login(
    dto: LoginRequestType,
    userAgent?: string,
  ): Promise<LoginOutcomeType> {
    const user = await this.userRepository.findFirst({
      // soft-deleted account resolves to a "deleted account" signal below;
      OR: [{ username: dto.identifier }, { email: dto.identifier }],
    });

    if (!user) {
      await this.passwordService.verify(
        dto.password,
        authConfig.dummyPasswordHash,
      );

      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.passwordService.verify(dto.password, user.passwordHash);
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.ACCOUNT_LOCKED,
        `Too many failed attempts. Try again in ${minutesLeft} minute${
          minutesLeft === 1 ? "" : "s"
        }.`,
      );
    }

    if (user.lockedUntil) {
      const fresh = await this.userRepository.resetLoginFailures(user.id);
      user.failedLoginAttempts = fresh.failedLoginAttempts;
      user.lockedUntil = fresh.lockedUntil;
    }

    const matches = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );

    // this uses raw query to be atomic
    // to avoid concurrent bypass.
    if (!matches) {
      // One trip: the repository bumps the counter and engages the
      // lockout in the same UPDATE when the threshold is crossed.
      await this.userRepository.recordFailedLogin(user.id);

      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    await this.userRepository.resetLoginFailures(user.id);

    // Deleted but the password matched: no tokens, no 2FA challenge — tell
    // the owner (only they know the password) and let them recover.
    if (user.deletedAt) {
      return {
        deleted: true,
        id: user.id,
        identifier: user.username,
        deletedAt: user.deletedAt.toISOString(),
        remainingMs: Math.max(
          0,
          user.deletedAt.getTime() + authConfig.accountRecoveryWindowMs - Date.now(),
        ),
        message: "This account was deleted and can no longer be signed in to.",
      };
    }

    if (!user.isEmailVerified) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "Email address is not verified.",
      );
    }

    // Password is good. If 2FA is on, don't hand out tokens yet — email a
    // code and return a challenge the client replays with the code.
    if (user.settings?.twoFactorEnabled) {
      await this.sendTwoFactorCode(user.id, user.username, user.email);

      const challengeId = this.jwtService.signJwt<TwoFactorChallengePayload>(
        { sub: user.id, purpose: "login_2fa" },
        { expiresIn: authConfig.twoFactor.challengeTtl },
      );

      return {
        twoFactorRequired: true,
        challengeId,
        message: "We emailed you a 6-digit verification code.",
      };
    }

    const result = await this.issueTokens(user.id, user.username, userAgent);
    this.sendNewDeviceLoginAlert(user, userAgent);
    return result;
  }

  // sessionId stays stable across every rotation of this login and rides in the
  // access token's `sid` claim, so revoking a session can drop its live sockets.
  // `existingSessionId` is set only when rotating an already-issued refresh
  // token; a fresh login always starts a brand new Session.
  private async issueTokens(
    userId: string,
    username: string,
    userAgent?: string | null,
    existingSessionId?: string,
  ): Promise<LoginResponseType> {
    const expiresAt = new Date(
      Date.now() + authConfig.refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
    );

    let sessionId: string;
    if (existingSessionId) {
      sessionId = existingSessionId;
      // Rolling lifetime: a session still being used stays alive.
      await this.refreshTokenRepository.touchSession(sessionId, expiresAt);
    } else {
      const session = await this.refreshTokenRepository.createSession({
        userId,
        userAgent: userAgent ?? null,
        expiresAt,
      });
      sessionId = session.id;
    }

    const token = this.jwtService.signJwt<AccessTokenPayload>(
      { sub: userId, username, sid: sessionId, typ: "access" },
      { expiresIn: "15m" },
    );

    const refreshTokenValue = this.generateToken();
    const refreshTokenHash = this.hashToken(refreshTokenValue);

    await this.refreshTokenRepository.create({
      tokenHash: refreshTokenHash,
      expiresAt,
      userId,
      sessionId,
    });

    return {
      accessToken: token,
      refreshToken: refreshTokenValue,
      user: { id: userId, identifier: username },
    };
  }

  async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<ListSessionsResponseType> {
    const sessions =
      await this.refreshTokenRepository.findActiveSessionsByUser(userId);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        // Every session created by issueTokens() always sets expiresAt;
        // the fallback only matters for a hand-inserted/backfilled row.
        expiresAt: (s.expiresAt ?? s.createdAt).toISOString(),
        current: s.id === currentSessionId,
      })),
    };
  }

  async revokeSession(
    userId: string,
    sessionKey: string,
  ): Promise<RevokeSessionResponseType> {
    const result = await this.refreshTokenRepository.revokeSessionForUser(
      userId,
      sessionKey,
    );
    if (result.count === 0) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND,
        "Session not found",
      );
    }
    await disconnectSockets({ userId, sessionIds: [sessionKey] });
    return { message: "Session ended" };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<RevokeSessionResponseType> {
    await this.refreshTokenRepository.revokeAllSessionsExceptForUser(
      userId,
      currentSessionId,
    );
    await disconnectSockets({ userId, keepSessionId: currentSessionId });
    return { message: "Other sessions ended" };
  }

  async revokeAllSessions(userId: string): Promise<RevokeSessionResponseType> {
    await this.refreshTokenRepository.revokeAllSessionsForUser(userId);
    await disconnectSockets({ userId });
    return { message: "Signed out on all devices" };
  }

  // change password email
  private async sendPasswordChangedAlert(user: EmailRecipient) {
    try {
      await this.emailService.sendPasswordChangedEmail({
        email: user.email,
        username: user.username,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send password-changed alert",
      );
    }
  }
  // new device login email.
  private async sendNewDeviceLoginAlert(
    user: EmailRecipient,
    userAgent?: string | null,
  ) {
    try {
      await this.emailService.sendNewDeviceLoginEmail({
        email: user.email,
        username: user.username,
        userAgent,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send new-device alert",
      );
    }
  }

  private async sendVerificationEmail(user: EmailRecipient, token: string) {
    try {
      await this.emailService.sendVerificationEmail({
        email: user.email,
        username: user.username,
        url: `${authConfig.frontendUrl}/verify-email?token=${token}`,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send verification email",
      );
    }
  }

  // send 2FA code.
  async sendTwoFactorCode(
    userId: string,
    username: string,
    email: string,
  ): Promise<void> {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = this.hashToken(code);

    await this.emailRepository.deleteAll({
      userId,
      type: VerificationTokenType.TWO_FACTOR,
    });
    await this.emailRepository.create({
      tokenHash: codeHash,
      type: VerificationTokenType.TWO_FACTOR,
      expiresAt: new Date(
        Date.now() + authConfig.twoFactor.codeTtlMinutes * 60 * 1000,
      ),
      user: { connect: { id: userId } },
    });

    try {
      await this.emailService.sendTwoFactorCode({
        email,
        username,
        code,
        expiresInMinutes: authConfig.twoFactor.codeTtlMinutes,
      });
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to send 2FA code email");
    }
  }

  // verify 2FA code.
  async consumeTwoFactorCode(
    userId: string,
    code: string,
  ): Promise<void> {
    const user = await this.userRepository.findBy({ id: userId });
    if (
      user?.twoFactorLockedUntil &&
      user.twoFactorLockedUntil.getTime() > Date.now()
    ) {
      throw new AppError(
        HTTP_STATUS.TOO_MANY_REQUESTS,
        ERROR_CODES.TWO_FACTOR_LOCKED,
        "Too many incorrect codes. Try again later.",
      );
    }

    const codeHash = this.hashToken(code);

    const record = await this.emailRepository.findBy({
      userId,
      type: VerificationTokenType.TWO_FACTOR,
      tokenHash: codeHash,
      expiresAt: { gt: new Date() },
    });

    if (!record) {
      // One trip: counter bump + conditional lockout in a single UPDATE,
      // so a burst of parallel wrong codes can't race the threshold.
      await this.userRepository.recordFailedTwoFactor(
        userId,
        authConfig.twoFactor.maxAttempts,
        authConfig.twoFactor.lockoutMs,
      );

      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_2FA_CODE,
        "That code is invalid or has expired.",
      );
    }

    await this.userRepository.resetTwoFactorFailures(userId);
    await this.emailRepository.deleteAll({
      userId,
      type: VerificationTokenType.TWO_FACTOR,
    });
  }

  private readChallenge(challengeId: string): string {
    let payload: TwoFactorChallengePayload;
    try {
      payload = this.jwtService.verifyJwt<
        TwoFactorChallengePayload & { [key: string]: unknown }
      >(challengeId);
    } catch {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_OR_EXPIRED_2FA_CODE,
        "Your login session expired. Please sign in again.",
      );
    }
    if (payload.purpose !== "login_2fa" || !payload.sub) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_OR_EXPIRED_2FA_CODE,
        "Your login session expired. Please sign in again.",
      );
    }
    return payload.sub;
  }

  async verifyLoginTwoFactor(
    dto: VerifyTwoFactorLoginRequestType,
    userAgent?: string,
  ): Promise<LoginResponseType> {
    const userId = this.readChallenge(dto.challengeId);

    const user = await this.userRepository.findBy({ id: userId });
    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Invalid credentials",
      );
    }

    await this.consumeTwoFactorCode(userId, dto.code);

    const result = await this.issueTokens(user.id, user.username, userAgent);
    this.sendNewDeviceLoginAlert(user, userAgent);
    return result;
  }

  async resendLoginTwoFactor(
    dto: ResendTwoFactorLoginRequestType,
  ): Promise<ResendTwoFactorLoginResponseType> {
    const userId = this.readChallenge(dto.challengeId);

    const user = await this.userRepository.findBy({ id: userId });
    if (user) {
      await this.sendTwoFactorCode(user.id, user.username, user.email);
    }

    return { message: "A new code is on its way." };
  }

  async requestTwoFactorSetup(
    userId: string,
  ): Promise<SetupTwoFactorResponseType> {
    const user = await this.userRepository.findBy({ id: userId });
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User does not exist",
      );
    }

    await this.sendTwoFactorCode(user.id, user.username, user.email);

    return { message: "We emailed you a 6-digit verification code." };
  }

  async enableTwoFactor(
    userId: string,
    dto: EnableTwoFactorRequestType,
  ): Promise<TwoFactorStatusResponseType> {
    await this.consumeTwoFactorCode(userId, dto.code);
    await this.settingsRepository.upsert(userId, { twoFactorEnabled: true });

    return {
      twoFactorEnabled: true,
      message: "Two-factor authentication is now on.",
    };
  }

  async disableTwoFactor(
    userId: string,
    dto: DisableTwoFactorRequestType,
  ): Promise<TwoFactorStatusResponseType> {
    const user = await this.userRepository.findBy({ id: userId });
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User does not exist",
      );
    }

    const matches = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );
    if (!matches) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Credentials do not match",
      );
    }

    await this.settingsRepository.upsert(userId, { twoFactorEnabled: false });
    await this.emailRepository.deleteAll({
      userId,
      type: VerificationTokenType.TWO_FACTOR,
    });

    return {
      twoFactorEnabled: false,
      message: "Two-factor authentication is now off.",
    };
  }

  async verifyEmail(
    dto: VerifyEmailRequestType,
  ): Promise<VerifyEmailResponseType> {
    const token = dto.token;
    const hashedToken = this.hashToken(token);

    const verification = await this.emailRepository.findBy({
      tokenHash: hashedToken,
      type: VerificationTokenType.EMAIL_VERIFICATION,
      expiresAt: {
        gt: new Date(),
      },
    });

    if (!verification) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_VERIFICATION_TOKEN,
        "Invalid or expired verification token",
      );
    }

    await this.emailRepository.markVerifiedAndClearTokens(verification.userId);

    return {
      message: "Email verified successfully",
    };
  }

  async resendVerificationEmail(
    dto: ResendVerificationRequestType,
  ): Promise<ResendVerificationResponseType> {
    const email = dto.email;

    const user = await this.userRepository.findActiveByEmail(email);

    const genericResponse: ResendVerificationResponseType = {
      message:
        "If an account exists, a verification link is sent to the email.",
    };

    if (!user) {
      return genericResponse;
    }

    if (user.isEmailVerified) {
      return genericResponse;
    }

    await this.emailRepository.deleteAll({
      userId: user.id,
      type: VerificationTokenType.EMAIL_VERIFICATION,
    });

    const token = this.generateToken();
    const hashedToken = this.hashToken(token);

    await this.emailRepository.create({
      tokenHash: hashedToken,
      type: VerificationTokenType.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + authConfig.verificationTokenTtlMs),
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    await this.sendVerificationEmail(user, token);

    return genericResponse;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordRequestType,
  ): Promise<ChangePasswordResponseType> {
    const user = await this.userRepository.findBy({
      id: userId,
    });

    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User does not exist",
      );
    }

    if (!user.isEmailVerified) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "Email is not verified",
      );
    }

    const matches = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!matches) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Credentials do not match",
      );
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.userRepository.updateBy(
      {
        id: user.id,
      },
      {
        passwordHash: newHash,
      },
    );

    this.sendPasswordChangedAlert(user);

    await this.refreshTokenRepository.revokeAllSessionsForUser(user.id);
    await disconnectSockets({ userId });

    return {
      message: "Password changed successfully",
    };
  }

  // Ends just the caller's own session. "Sign out on all devices" is a
  // separate action — see revokeAllSessions.
  async logout(
    userId: string,
    currentSessionId: string,
  ): Promise<LogoutResponseType> {
    await this.refreshTokenRepository.revokeSessionForUser(
      userId,
      currentSessionId,
    );
    await disconnectSockets({ userId, sessionIds: [currentSessionId] });

    return { message: "Logged out successfully" };
  }

  async refreshAccessToken(
    dto: RefreshTokenRequestType,
  ): Promise<RefreshTokenResponseType> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const stored = await this.refreshTokenRepository.findFirst({
      tokenHash,
    });

    if (!stored) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_REFRESH_TOKEN,
        "Invalid refresh token",
      );
    }

    if (stored.revokedAt) {
      logger.warn(
        { userId: stored.userId, sessionId: stored.sessionId },
        "Refresh token reuse detected — revoking all sessions",
      );
      await this.refreshTokenRepository.revokeAllSessionsForUser(stored.userId);
      await disconnectSockets({ userId: stored.userId });

      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED,
        "Unauthorized access detected. All sessions have been revoked for your protection.",
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.REFRESH_TOKEN_EXPIRED,
        "Refresh token has expired",
      );
    }

    const session = stored.sessionId
      ? await this.refreshTokenRepository.findSessionById(stored.sessionId)
      : null;
    if (!session || session.revokedAt || session.userId !== stored.userId) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_REFRESH_TOKEN,
        "Invalid refresh token",
      );
    }

    const user = await this.userRepository.findActiveById(stored.userId);
    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_REFRESH_TOKEN,
        "Invalid refresh token",
      );
    }

    await this.refreshTokenRepository.revoke(stored.id);

    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.username,
      null,
      stored.sessionId ?? undefined,
    );

    return { accessToken, refreshToken };
  }

  async forgotPassword(
    dto: ForgotPasswordRequestType,
  ): Promise<ForgotPasswordResponseType> {
    const user = await this.userRepository.findActiveByEmail(dto.email);
    const genericResponse: ForgotPasswordResponseType = {
      message: "If an account exists, reset link is sent to the email.",
    };
    if (!user) {
      return genericResponse;
    }

    if (!user.isEmailVerified) {
      return genericResponse;
    }

    await this.emailRepository.deleteAll({
      userId: user.id,
      type: VerificationTokenType.PASSWORD_RESET,
    });

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    await this.emailRepository.create({
      tokenHash,
      expiresAt: new Date(Date.now() + authConfig.passwordResetTokenTtlMs),
      type: VerificationTokenType.PASSWORD_RESET,
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    const url = `${authConfig.frontendUrl}/reset-password?token=${token}`;

    try {
      await this.emailService.sendPasswordResetEmail({
        email: user.email,
        subject: "Reset Your Password",
        resetPasswordUrl: url,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send password reset email",
      );
    }

    return genericResponse;
  }

  async resetPassword(
    dto: ResetPasswordRequestType,
  ): Promise<ResetPasswordResponseType> {
    const tokenHash = this.hashToken(dto.token);

    const token = await this.emailRepository.findBy({
      tokenHash,
      type: VerificationTokenType.PASSWORD_RESET,
      expiresAt: {
        gt: new Date(),
      },
    });

    if (!token) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_RESET_TOKEN,
        "Invalid or expired token",
      );
    }

    const user = await this.userRepository.findActiveById(token.userId);
    if (!user || !user.isEmailVerified) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_RESET_TOKEN,
        "Invalid or expired token",
      );
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.emailRepository.resetPasswordAndClearToken(
      token.userId,
      passwordHash,
      token.id,
    );

    await this.refreshTokenRepository.revokeAllSessionsForUser(token.userId);
    await disconnectSockets({ userId: token.userId });

    this.sendPasswordChangedAlert(user);

    return {
      message: "Password reset successful",
    };
  }

  // ─── Account recovery (soft-delete undo window) ──────────────────

  /** Creates a fresh recovery token + email for a soft-deleted user, guarded
   * to the 30-day window anchored on `deletedAt` (resending never extends it).
   * Used by `deleteMe` and by `POST /recover-account`. */
  async requestAccountRecovery(userId: string): Promise<void> {
    const user = await this.userRepository.findBy({ id: userId });
    if (!user?.deletedAt) return;

    const windowEnd =
      user.deletedAt.getTime() + authConfig.accountRecoveryWindowMs;
    if (Date.now() > windowEnd) return;

    await this.emailRepository.deleteAll({
      userId: user.id,
      type: VerificationTokenType.ACCOUNT_RECOVERY,
    });

    const token = this.generateToken();
    await this.emailRepository.create({
      tokenHash: this.hashToken(token),
      type: VerificationTokenType.ACCOUNT_RECOVERY,
      expiresAt: new Date(windowEnd),
      user: { connect: { id: user.id } },
    });

    const url = `${authConfig.frontendUrl}/verify-recovery?token=${token}`;
    try {
      await this.emailService.sendAccountRecoveryEmail({
        email: user.email,
        username: user.username,
        url,
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send account recovery email",
      );
    }
  }

  async recoverAccount(
    dto: RecoverAccountRequestType,
  ): Promise<RecoverAccountResponseType> {
    const genericResponse: RecoverAccountResponseType = {
      message:
        "If your account is within its recovery window, a recovery link has been sent to your email.",
    };

    // Look the user up by email even when deleted — unlike reset/verify paths,
    // this is the one flow that's *meant* to reach soft-deleted rows.
    const user = await this.userRepository.findBy({ email: dto.email });
    if (!user?.deletedAt) return genericResponse;

    const windowEnd =
      user.deletedAt.getTime() + authConfig.accountRecoveryWindowMs;
    if (Date.now() > windowEnd) return genericResponse;

    await this.requestAccountRecovery(user.id);
    return genericResponse;
  }

  async verifyRecovery(
    dto: VerifyRecoveryRequestType,
  ): Promise<VerifyRecoveryResponseType> {
    const token = await this.emailRepository.findBy({
      tokenHash: this.hashToken(dto.token),
      type: VerificationTokenType.ACCOUNT_RECOVERY,
      expiresAt: { gt: new Date() },
    });

    if (!token) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_RECOVERY_TOKEN,
        "This recovery link is invalid or has expired",
      );
    }

    const user = await this.userRepository.findBy({ id: token.userId });
    if (!user?.deletedAt) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_OR_EXPIRED_RECOVERY_TOKEN,
        "This recovery link is invalid or has expired",
      );
    }

    await this.userRepository.restoreDeleted(token.userId);
    await this.emailRepository.deleteAll({
      userId: token.userId,
      type: VerificationTokenType.ACCOUNT_RECOVERY,
    });

    return { message: "Your account has been restored" };
  }
}
