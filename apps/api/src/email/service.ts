import { verificationEmail } from "./templates/verify-email";
import { Resend } from "resend";
import logger from "@/lib/logger";
import { resetPasswordEmail } from "./templates/reset-password";
import { twoFactorCodeEmail } from "./templates/two-factor-code";
import { env } from "@/config";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEV_EMAIL = "mouanvikram@gmail.com";

export class EmailService {
	async sendEmail(dto: {
		to: string | null;
		subject: string;
		html: string;
	}): Promise<void> {
		const recipient = env.NODE_ENV === "production" ? (dto.to ?? DEV_EMAIL) : DEV_EMAIL;

		try {
			const { data, error } = await resend.emails.send({
				from: "onboarding@resend.dev",
				to: recipient,
				subject: dto.subject,
				html: dto.html,
			});

			if (error) {
				logger.error({ error }, "Failed to send email");
				throw new Error(error.message);
			}
		} catch (error) {
			logger.error({ error }, "Failed to send email");
			throw error;
		}
	}
	async sendVerificationEmail(dto: {
		username: string;
		email: string;
		url: string;
	}) {
		return this.sendEmail({
			to: dto.email,
			subject: "Verify Your Email",
			html: verificationEmail(dto.username ?? dto.email, dto.url),
		});
	}

	async sendPasswordResetEmail(dto: {
		email: string;
		subject: string;
		resetPasswordUrl: string;
	}) {
		return this.sendEmail({
			to: dto.email,
			subject: dto.subject,
			html: resetPasswordEmail(dto.email, dto.resetPasswordUrl),
		});
	}

	async sendTwoFactorCode(dto: {
		email: string;
		username: string;
		code: string;
		expiresInMinutes: number;
	}) {
		return this.sendEmail({
			to: dto.email,
			subject: `${dto.code} is your verification code`,
			html: twoFactorCodeEmail(
				dto.username ?? dto.email,
				dto.code,
				dto.expiresInMinutes,
			),
		});
	}
}
