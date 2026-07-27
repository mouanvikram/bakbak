import type { UserRepository } from "../users/repository";

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}
  register() {}
  login() {}
  logout() {}
  refreshToken() {}
  verifyEmail() {}
  resendVerificationEmail() {}
  forgotPassword() {}
  resetPassword() {}
}
