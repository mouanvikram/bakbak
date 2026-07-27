// import {ver}

import { verificationEmail } from "@emails/verify";

export class EmailService {
  constructor() {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {}
  async sendVerificationEmail(email: string,verificationUrl:string) {
    return this.sendEmail(email,"Verify Your Email",verificationEmail())
  }

  async sendPasswordResetEmail(email: string, resetPasswordUrl: string) {}
}
