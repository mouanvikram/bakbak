import { verificationEmail } from "@lib/emails.template/verify-email";
import type { SendVerificationEmailDto, VerfiyEmailType } from "./types";
import { Resend } from "resend";
import logger from "@logger";
import { resetPasswordEmail } from "@lib/emails.template/reset-password";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {

  async sendEmail(dto: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const { data, error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: "mouanvikram@gmail.com",
        subject: dto.subject,
        html: dto.html,
      });

      // logger.info()
      logger.info(data);
      //   return data;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
  async sendVerificationEmail(dto: SendVerificationEmailDto) {
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
}
