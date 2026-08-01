import { EmailRepository } from "../auth/email.repository";
import { EmailService } from "../auth/email.service";
import { JwtService } from "../auth/jwt.service";
import { PasswordService } from "../auth/pwd.service";
import { AuthService } from "../auth/service";
import { FriendController } from "../friends/controller";
import { FriendService } from "../friends/service";
import { UserRepository } from "../users/repository";
import { UserService } from "../users/service";

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
export const userService = new UserService(userRepository);

export const friendService = new FriendService();
export const friendController: FriendController = new FriendController(
  friendService,
);
