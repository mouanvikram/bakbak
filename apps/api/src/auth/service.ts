import type { JwtService } from "./jwt.service";
import type { PasswordService } from "./pwd.service";
import type { UserRepository } from "../users/repository";
import type { LoginDto, RegisterDto } from "./types";
import type { EmailService } from "./email.service";

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pwdService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}
  
  async register(dto: RegisterDto) {
    //userRepository check if the user exists or not
    const userExists = await this.userRepository.findFirst({
      username: dto.username,
      email: dto.email,
    });

    if (userExists) {
      throw new Error("Email/Username already exists");
    }

    // hash password service
    const hashedPassword = await this.pwdService.hash(dto.password);

    // create user in the database
    const user = await this.userRepository.create({
      username: dto.username,
      email: dto.email,
      passwordHash: hashedPassword,
      profile: {
        create: {
          firstName: dto.firstname,
          lastName: dto.lastname,
          avatar: dto.avatarUrl,
          displayName: dto.displayName,
          bio: dto.bio,
          username: dto.username,
        },
      },
    });

    // generate jwt token
    const token = this.jwtService.signJwt({
      id: user.id,
    });

    // send verification email
    const url = "http://localhost:3000/verify-email?token=" + token;

    const emailSent = await this.emailService.sendVerificationEmail({
      email: user.email,
      username: user.username,
      url,
    });

    // return user
    return {
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        isEmailVerified: user.isEmailVerified,
        profile: user.profile,
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    // return
  }
  logout() {
    // will be implemented later
  }
  refreshToken() {
    // will be implemented later
  }
  verifyEmail() {}
  resendVerificationEmail() {}
  forgotPassword() {}
  resetPassword() {}
}
