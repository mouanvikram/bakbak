import type { AccessTokenPayload, JwtService } from "./jwt.service";
import type { PasswordService } from "./password.service";
import type { UserRepository } from "../users/repository";
import type { EmailService } from "../email/service";
import crypto from "crypto";
import type { EmailRepository } from "../email/repository";
import type { RefreshTokenRepository } from "./refresh-token.repository";
import type { SettingsRepository } from "../settings/repository";
import { VerificationTokenType } from "@bakbak/db";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { env } from "@/config";
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
	SignUpRequestType,
	SignUpResponseType,
	VerifyEmailRequestType,
	VerifyEmailResponseType,
	RefreshTokenRequestType,
	RefreshTokenResponseType,
	LogoutRequestType,
	LogoutResponseType,
	LoginOutcomeType,
	VerifyTwoFactorLoginRequestType,
	ResendTwoFactorLoginRequestType,
	ResendTwoFactorLoginResponseType,
	EnableTwoFactorRequestType,
	TwoFactorStatusResponseType,
	SetupTwoFactorResponseType,
} from "@bakbak/contracts";
import type { StorageProvider } from "../uploads/storage.provider";
import type { UploadRepository } from "../uploads/repository";
import type { AvatarTokenStore } from "../avatar/token.store";
import { titleCaseName } from "../lib/name-case";
import {
	extensionFrom,
	kindFromExtension,
	kindFromMime,
} from "../uploads/file-type";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** How long an emailed 6-digit 2FA code stays valid. */
const TWO_FACTOR_CODE_TTL_MINUTES = 10;
/** Lifetime of the opaque challenge that ties a pending login to its 2FA step. */
const TWO_FACTOR_CHALLENGE_TTL = "10m";

interface TwoFactorChallengePayload {
	sub: string;
	purpose: "login_2fa";
}

export class AuthService {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly pwdService: PasswordService,
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
		private readonly emailRepository: EmailRepository,
		private readonly refreshTokenRepository: RefreshTokenRepository,
		private readonly avatarTokenStore: AvatarTokenStore,
		private readonly storageProvider: StorageProvider,
		private readonly uploadRepository: UploadRepository,
		private readonly settingsRepository: SettingsRepository,
	) {}

	async register(dto: SignUpRequestType): Promise<SignUpResponseType> {
		//userRepository check if the user exists or not
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

		// hash password service
		const hashedPassword = await this.pwdService.hash(dto.password);

		// resolve a pending avatar file (if any) from the pre-signup upload
		const avatarUrl =
			(await this.resolveAvatar(dto.avatarToken)) ?? dto.avatarUrl ?? null;

		const token = crypto.randomBytes(32).toString("hex");
		// send verification email
		// URL service
		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

		// create user in the database
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
					expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				},
			},
		});

		const url = `${env.FRONTEND_URL}/verify-email?token=${token}`;

		// send the mail to the user.
		// Best-effort: the user and token are already persisted, so a delivery
		// failure must not fail the request — the client can use
		// resend-verification instead of hitting a 500 with a zombie account.
		try {
			await this.emailService.sendVerificationEmail({
				email: user.email,
				username: user.username,
				url,
			});
		} catch (error) {
			logger.error(
				{ err: error, userId: user.id },
				"Failed to send verification email",
			);
		}

		// return user
		return {
			message: "Verification email sent successfully",
		} as SignUpResponseType;
	}

	/**
	 * Takes a pending avatar token from the pre-signup upload and writes the
	 * file to object storage + the database, returning a public URL. This runs
	 * only once signup completes (it is called from register), so abandoned
	 * signups never persist anything.
	 */
	private async resolveAvatar(avatarToken: string | undefined): Promise<string | null> {
		if (!avatarToken) return null;

		const file = this.avatarTokenStore.consume(avatarToken);
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

			// Persist the durable storage key; it is resolved to a fetchable
			// signed URL when the profile is served (see UserService).
			return key;
		} catch (error) {
			// A failed avatar write must not block account creation.
			logger.error(
				{ err: error, avatarToken },
				"Failed to persist pending avatar on signup",
			);
			return null;
		}
	}
	private buildAvatarKey(originalName: string): string {
		const ext = extensionFrom(originalName);
		const uuid = crypto.randomUUID();
		return `avatars/${uuid}${ext ? `.${ext}` : ""}`;
	}

	async login(dto: LoginRequestType): Promise<LoginOutcomeType> {
		const user = await this.userRepository.findFirst({
			OR: [{ username: dto.identifier }, { email: dto.identifier }],
		});

		if (!user) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.INVALID_CREDENTIALS,
				"Invalid credentials",
			);
		}

		// Reject attempts while the account is locked (checked before the
		// password round-trip to avoid burning CPU on a locked account).
		if (user.lockedUntil) {
			if (user.lockedUntil.getTime() > Date.now()) {
				throw new AppError(
					HTTP_STATUS.TOO_MANY_REQUESTS,
					ERROR_CODES.ACCOUNT_LOCKED,
					"Too many failed attempts. Account is temporarily locked.",
				);
			}
			// Lockout has expired — clear the stale state so the user
			// gets a fresh attempt window.
			await this.userRepository.resetLoginFailures(user.id);
			user.failedLoginAttempts = 0;
			user.lockedUntil = null;
		}

		// matching password
		const matches = await this.pwdService.verify(
			dto.password,
			user.passwordHash,
		);

		if (!matches) {
			const failedAttempts = user.failedLoginAttempts + 1;
			if (failedAttempts >= env.LOGIN_MAX_ATTEMPTS) {
				await this.userRepository.lockLoginFor(user.id);
			} else {
				await this.userRepository.recordFailedLogin(user.id);
			}

			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.INVALID_CREDENTIALS,
				"Invalid credentials",
			);
		}

		await this.userRepository.resetLoginFailures(user.id);

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
				{ expiresIn: TWO_FACTOR_CHALLENGE_TTL },
			);

			return {
				twoFactorRequired: true,
				challengeId,
				message: "We emailed you a 6-digit verification code.",
			};
		}

		return this.issueTokens(user.id, user.username);
	}

	/** Mint an access + refresh token pair for a fully authenticated user. */
	private async issueTokens(
		userId: string,
		username: string,
	): Promise<LoginResponseType> {
		const token = this.jwtService.signJwt<AccessTokenPayload>(
			{ sub: userId, username },
			{ expiresIn: "15m" },
		);

		const refreshTokenValue = crypto.randomBytes(32).toString("hex");
		const refreshTokenHash = crypto
			.createHash("sha256")
			.update(refreshTokenValue)
			.digest("hex");

		const expiresAt = new Date(
			Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
		);

		await this.refreshTokenRepository.create({
			tokenHash: refreshTokenHash,
			expiresAt,
			user: { connect: { id: userId } },
		});

		return {
			accessToken: token,
			refreshToken: refreshTokenValue,
			user: { id: userId, identifier: username },
		};
	}

	// ─── Two-factor authentication ────────────────────────────────────

	/** Generate, store (hashed), and email a fresh 6-digit code. Replaces any
	 * outstanding code for the user. Email failure is logged, not thrown, so a
	 * flaky mail provider can't wedge the account. */
	private async sendTwoFactorCode(
		userId: string,
		username: string,
		email: string,
	): Promise<void> {
		const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
		const codeHash = crypto.createHash("sha256").update(code).digest("hex");

		await this.emailRepository.deleteAll({
			userId,
			type: VerificationTokenType.TWO_FACTOR,
		});
		await this.emailRepository.create({
			tokenHash: codeHash,
			type: VerificationTokenType.TWO_FACTOR,
			expiresAt: new Date(
				Date.now() + TWO_FACTOR_CODE_TTL_MINUTES * 60 * 1000,
			),
			user: { connect: { id: userId } },
		});

		try {
			await this.emailService.sendTwoFactorCode({
				email,
				username,
				code,
				expiresInMinutes: TWO_FACTOR_CODE_TTL_MINUTES,
			});
		} catch (error) {
			logger.error({ err: error, userId }, "Failed to send 2FA code email");
		}
	}

	/** Verify a submitted code against the stored hash and consume it. */
	private async consumeTwoFactorCode(
		userId: string,
		code: string,
	): Promise<void> {
		const codeHash = crypto.createHash("sha256").update(code).digest("hex");

		const record = await this.emailRepository.findBy({
			userId,
			type: VerificationTokenType.TWO_FACTOR,
			tokenHash: codeHash,
			expiresAt: { gt: new Date() },
		});

		if (!record) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.INVALID_OR_EXPIRED_2FA_CODE,
				"That code is invalid or has expired.",
			);
		}

		await this.emailRepository.deleteAll({
			userId,
			type: VerificationTokenType.TWO_FACTOR,
		});
	}

	private readChallenge(challengeId: string): string {
		let payload: TwoFactorChallengePayload;
		try {
			payload =
				this.jwtService.verifyJwt<
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

		return this.issueTokens(user.id, user.username);
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

	/** Step 1 of turning 2FA on: email the user a code to confirm ownership. */
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

	/** Step 2: confirm the code and flip the flag on. */
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
	): Promise<TwoFactorStatusResponseType> {
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

		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

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

		const user = await this.userRepository.findBy({
			email,
		});

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

		const token = crypto.randomBytes(32).toString("hex");
		const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

		await this.emailRepository.create({
			tokenHash: hashedToken,
			type: VerificationTokenType.EMAIL_VERIFICATION,
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			user: {
				connect: {
					id: user.id,
				},
			},
		});

		const url = `${env.FRONTEND_URL}/verify-email?token=${token}`;

		try {
			await this.emailService.sendVerificationEmail({
				username: user.username,
				email,
				url,
			});
		} catch (error) {
			logger.error(
				{ err: error, userId: user.id },
				"Failed to send verification email",
			);
		}

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

		const matches = await this.pwdService.verify(
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

		const newHash = await this.pwdService.hash(dto.newPassword);
		await this.userRepository.updateBy(
			{
				id: user.id,
			},
			{
				passwordHash: newHash,
			},
		);

		return {
			message: "Password changed successfully",
		};
	}

	async logout(
		userId: string,
		dto: LogoutRequestType,
	): Promise<LogoutResponseType> {
		if (dto.refreshToken) {
			const tokenHash = crypto
				.createHash("sha256")
				.update(dto.refreshToken)
				.digest("hex");

			const stored = await this.refreshTokenRepository.findFirst({
				tokenHash,
				userId,
			});

			if (stored && !stored.revokedAt) {
				await this.refreshTokenRepository.revoke(stored.id);
			}
		} else {
			await this.refreshTokenRepository.revokeAll(userId);
		}

		return { message: "Logged out successfully" };
	}

	async refreshAccessToken(
		dto: RefreshTokenRequestType,
	): Promise<RefreshTokenResponseType> {
		const tokenHash = crypto
			.createHash("sha256")
			.update(dto.refreshToken)
			.digest("hex");

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
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.INVALID_REFRESH_TOKEN,
				"Refresh token has been revoked",
			);
		}

		if (stored.expiresAt < new Date()) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.REFRESH_TOKEN_EXPIRED,
				"Refresh token has expired",
			);
		}

		// Revoke the old token (rotation)
		await this.refreshTokenRepository.revoke(stored.id);

		// Look up the user to get their username for the new access token
		const user = await this.userRepository.findBy({
			id: stored.userId,
		});

		if (!user) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.INVALID_REFRESH_TOKEN,
				"User not found",
			);
		}

		// Issue new access token
		const newAccessToken = this.jwtService.signJwt<AccessTokenPayload>(
			{
				sub: user.id,
				username: user.username,
			},
			{
				expiresIn: "15m",
			},
		);

		// Issue new refresh token
		const newRefreshTokenValue = crypto.randomBytes(32).toString("hex");
		const newRefreshTokenHash = crypto
			.createHash("sha256")
			.update(newRefreshTokenValue)
			.digest("hex");

		const expiresAt = new Date(
			Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
		);

		await this.refreshTokenRepository.create({
			tokenHash: newRefreshTokenHash,
			expiresAt,
			user: {
				connect: {
					id: stored.userId,
				},
			},
		});

		return {
			accessToken: newAccessToken,
			refreshToken: newRefreshTokenValue,
		};
	}

	async forgotPassword(
		dto: ForgotPasswordRequestType,
	): Promise<ForgotPasswordResponseType> {
		// change password on clicking forgot password.
		const user = await this.userRepository.findBy({
			email: dto.email,
		});
		const genericResponse: ForgotPasswordResponseType = {
			message: "If an account exists, reset link is sent to the email.",
		};
		if (!user) {
			return genericResponse;
		}

		// delete all the tokens before it.
		await this.emailRepository.deleteAll({
			userId: user.id,
			type: VerificationTokenType.PASSWORD_RESET,
		});

		const token = crypto.randomBytes(32).toString("hex");
		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

		// register new token;
		await this.emailRepository.create({
			tokenHash,
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			type: VerificationTokenType.PASSWORD_RESET,
			user: {
				connect: {
					id: user.id,
				},
			},
		});

		const url = `${env.FRONTEND_URL}/reset-password?token=${token}`;

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
		const tokenHash = crypto
			.createHash("sha256")
			.update(dto.token)
			.digest("hex");

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

		const passwordHash = await this.pwdService.hash(dto.newPassword);

		await this.emailRepository.resetPasswordAndClearToken(
			token.userId,
			passwordHash,
			token.id,
		);

		return {
			message: "Password reset successful",
		};
	}
}
