import { AuthController } from "../auth/controller";
import { EmailRepository } from "../email/repository";
import { EmailService } from "../email/service";
import { JwtService } from "../auth/jwt.service";
import { PasswordService } from "../auth/password.service";
import { RefreshTokenRepository } from "../auth/refresh-token.repository";
import { AuthService } from "../auth/service";
import { ChatController } from "../chat/controller";
import { ChatService } from "../chat/service";
import { ChatRepository } from "../chat/repository";
import { FriendController } from "../friends/controller";
import { FriendRepository } from "../friends/repository";
import { FriendService } from "../friends/service";
import { MessageController } from "../messages/controller";
import { MessageRepository } from "../messages/repository";
import { MessageService } from "../messages/service";
import { SettingsController } from "../settings/controller";
import { SettingsRepository } from "../settings/repository";
import { SettingsService } from "../settings/service";
import { UploadController } from "../uploads/controller";
import { UploadRepository } from "../uploads/repository";
import { UploadService } from "../uploads/service";
import { storageProvider } from "../uploads/storage";
import { UserController } from "../users/controller";
import { UserRepository } from "../users/repository";
import { UserService } from "../users/service";
import { env } from "@/config";

export const userRepository = new UserRepository();
export const pwdService = new PasswordService();
export const jwtService = new JwtService(env.JWT_SECRET);
export const emailService = new EmailService();
export const emailRepository = new EmailRepository();
export const refreshTokenRepository = new RefreshTokenRepository();
export const uploadRepository = new UploadRepository();
export const settingsRepository = new SettingsRepository();
export const authService = new AuthService(
	userRepository,
	pwdService,
	jwtService,
	emailService,
	emailRepository,
	refreshTokenRepository,
	storageProvider,
	uploadRepository,
	settingsRepository,
);
export const authController = new AuthController(authService);

export const friendRepository = new FriendRepository();
export const friendService = new FriendService(friendRepository, storageProvider);
export const friendController = new FriendController(friendService);

export const userService = new UserService(
	userRepository,
	storageProvider,
	friendRepository,
);
export const userController = new UserController(userService);

export const chatRepository = new ChatRepository();
export const chatService = new ChatService(chatRepository, storageProvider);
export const chatController = new ChatController(chatService);

export const messageRepository = new MessageRepository();
export const messageService = new MessageService(
	messageRepository,
	storageProvider,
	uploadRepository,
);
export const messageController = new MessageController(messageService);
export const settingsService = new SettingsService(settingsRepository);
export const settingsController = new SettingsController(settingsService);

export const uploadService = new UploadService(uploadRepository, storageProvider);
export const uploadController = new UploadController(uploadService);
