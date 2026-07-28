// import {ver}

import { verificationEmail } from "@emails/verify";
import type { VerfiyEmailType } from "./types";
import { Resend } from "resend";
import logger from "@logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  constructor() {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      const { data, error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: "mouanvikram@gmail.com",
        subject,
        html,
      });

      logger.info(data);
      logger.error(error);
      //   return data;
    } catch (error) {
      logger.error(error);

      throw error;
    }
  }
  async sendVerificationEmail(dto: VerfiyEmailType) {
    return this.sendEmail(
      dto.email,
      "Verify Your Email",
      verificationEmail(dto.username ?? dto.email, dto.url),
    );
  }

  async sendPasswordResetEmail(
    fullname: string,
    email: string,
    resetPasswordUrl: string,
  ) {}
}
