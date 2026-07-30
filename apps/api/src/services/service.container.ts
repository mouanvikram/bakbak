import { EmailRepository } from "../auth/email.repository";
import { EmailService } from "../auth/email.service";
import { JwtService } from "../auth/jwt.service";
import { PasswordService } from "../auth/pwd.service";
import { AuthService } from "../auth/service";
import { UserRepository } from "../users/repository";

export const userRepository = new UserRepository();
export const pwdService = new PasswordService();
export const jwtService = new JwtService(process.env.JWT_SECRET!);
export const emailService = new EmailService();
export const emailRepository = new EmailRepository();
export const authService = new AuthService(
  userRepository,
  pwdService,
  jwtService,
  emailService,
  emailRepository,
);
