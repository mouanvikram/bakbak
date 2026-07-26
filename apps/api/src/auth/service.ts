import { prisma } from "@sealchat/db";

class AuthService {
  register() {}
  login() {}
  logout() {}
  refreshToken() {}
  verifyEmail() {}
  resendVerificationEmail() {}
  forgotPassword() {}
  resetPassword() {}
}

export const authService = new AuthService();
