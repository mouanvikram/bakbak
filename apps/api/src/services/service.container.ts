import { AuthController } from "../auth/controller";
import { EmailRepository } from "../auth/email.repository";
import { EmailService } from "../auth/email.service";
import { JwtService } from "../auth/jwt.service";
import { PasswordService } from "../auth/pwd.service";
import { AuthService } from "../auth/service";
import { ChatController } from "../chat/controller";
import { ChatService } from "../chat/service";
import { ChatRepository } from "../chat/repository";
import { FriendController } from "../friends/controller";
import { FriendRepository } from "../friends/repository";
import { FriendService } from "../friends/service";
import { UserController } from "../users/controller";
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
export const authController = new AuthController(authService);
export const userService = new UserService(userRepository);
export const userController = new UserController(userService);

// friends
export const friendRepository = new FriendRepository();
export const friendService = new FriendService(friendRepository);
export const friendController = new FriendController(friendService);

// chat service
export const chatRepository = new ChatRepository();
export const chatService = new ChatService(chatRepository);
export const chatController = new ChatController(chatService);
