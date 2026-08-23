import type { AccessTokenPayload, JwtService } from "../helpers/jwt.service";
import type { PasswordService } from "../helpers/pwd.service";
import type { UserRepository } from "../users/repository";
import type { EmailService } from "../helpers/email.service";
import crypto from "crypto";
import type { EmailRepository } from "../helpers/email.repository";
import { VerificationTokenType } from "@bakbak/db";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import { env } from "../../lib/config";
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
} from "@bakbak/contracts";

export class AuthService {
	constructor(
		private readonly userRepository: UserRepository,
		private readonly pwdService: PasswordService,
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
		private readonly emailRepository: EmailRepository,
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
					firstName: dto.firstname,
					lastName: dto.lastname,
					avatar: dto.avatarUrl,
					displayName: dto.displayname,
					bio: dto.bio, //modified
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
		await this.emailService.sendVerificationEmail({
			email: user.email,
			username: user.username,
			url,
		});

		// return user
		return {
			message: "Verification email sent successfully",
		} as SignUpResponseType;
	}

	async login(dto: LoginRequestType): Promise<LoginResponseType> {
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

		// matching password
		const matches = await this.pwdService.verify(
			dto.password,
			user.passwordHash,
		);

		if (!matches) {
			throw new AppError(
				HTTP_STATUS.UNAUTHORIZED,
				ERROR_CODES.INVALID_CREDENTIALS,
				"Invalid credentials",
			);
		}

		if (!user.isEmailVerified) {
			throw new AppError(
				HTTP_STATUS.FORBIDDEN,
				ERROR_CODES.EMAIL_NOT_VERIFIED,
				"Email address is not verified.",
			);
		}

		// generate jwt token
		const token = this.jwtService.signJwt<AccessTokenPayload>(
			{
				sub: user.id,
				username: user.username,
			},
			{
				expiresIn: "15m",
			},
		);

		return {
			accessToken: token,
			user: {
				id: user.id,
				identifier: user.username,
			},
		} as LoginResponseType;
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

		await this.userRepository.updateBy(
			{
				id: verification.userId,
			},
			{
				isEmailVerified: true,
			},
		);

		await this.emailRepository.deleteAll({
			userId: verification.userId,
			type: VerificationTokenType.EMAIL_VERIFICATION,
		});

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

		if (!user) {
			return {
				message: "If an account exists, reset link is sent to the email.",
			} as ResendVerificationResponseType;
		}

		if (user.isEmailVerified) {
			return {
				message: "If an account exists, reset link is sent to the email.",
			} as ResendVerificationResponseType;
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

		await this.emailService.sendVerificationEmail({
			username: user.username,
			email,
			url,
		});

		return {
			message:
				"If an account exists, verification link has been sent to the email.",
		} as ResendVerificationResponseType;
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
				ERROR_CODES.EMAIL_NOT_VERIFIED,
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

	logout() {
		// will be implemented later
	}

	refreshToken() {
		// will be implemented later
	}

	async forgotPassword(
		dto: ForgotPasswordRequestType,
	): Promise<ForgotPasswordResponseType> {
		// change password on clicking forgot password.
		const user = await this.userRepository.findBy({
			email: dto.email,
		});
		const genericResponse: ForgotPasswordResponseType = {
			message: "If account exists, a reset link is sent to email.",
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

		await this.emailService.sendPasswordResetEmail({
			email: user.email,
			subject: "Reset Your Password",
			resetPasswordUrl: url,
		});

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

		await this.userRepository.updateBy(
			{
				id: token.userId,
			},
			{
				passwordHash,
			},
		);

		await this.emailRepository.deleteAll({
			id: token.id,
		});

		return {
			message: "Password reset successful",
		};
	}
}
