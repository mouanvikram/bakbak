import type { JwtService } from "./jwt.service";
import type { PasswordService } from "./pwd.service";
import type { UserRepository } from "../users/repository";
import type { LoginDto, RegisterDto, VerfiyEmailType } from "./types";
import type { EmailService } from "./email.service";
import { prisma } from "@sealchat/db";
import crypto from "crypto";
import logger from "@logger";
import type { EmailRepository } from "./email.repository";

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pwdService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly emailRepository: EmailRepository,
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

    const token = crypto.randomBytes(32).toString("hex");
    // send verification email
    // URL service
    const hasedToken = crypto.createHash("sha256").update(token).digest("hex");

    const url = `http://localhost:3000/api/auth/verify-email?token=${token}`;

    // save the token in EmailVerification tble

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
      verification: {
        create: {
          verificationHash: hasedToken,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
      },
    });

    // send the mail to the user.
    await this.emailService.sendVerificationEmail({
      email: user.email,
      username: user.username,
      url,
    });

    // return user
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile,
    };
  }

  async login(dto: LoginDto) {
    const userExists = await this.userRepository.findFirst({
      OR: [{ username: dto.identifier }, { email: dto.identifier }],
    });
    if (!userExists) {
      throw new Error("Email/Username does not exits");
    }

    if (!userExists.isEmailVerified) {
      throw new Error("Email is not verified");
    }

    // generate jwt token
    const token = this.jwtService.signJwt(
      {
        sub: userExists.id,
        username: userExists.username,
      },
      {
        expiresIn: "15m",
      },
    );

    return {
      id: userExists.id,
      token,
    };
  }

  async verifyEmail(dto: VerfiyEmailType) {
    try {
      const token = dto.token;

      if (token !== "string") {
        logger.error("token is not typeof string");
        throw new Error("Invalid Token");
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const emailVerification = await this.emailRepository.findBy({
        verificationHash: hashedToken,
        expiresAt: {
          gt: new Date(),
        },
      });
      if (!emailVerification) {
        throw new Error("User does not exits");
      }

      const user = await this.userRepository.updateBy(
        {
          id: emailVerification?.userId,
        },
        {
          isEmailVerified: true,
        },
      );

      return {
        email: user.email,
      };
    } catch (error) {
      logger.error(error);
      throw new Error("Internal Server error 500");
    }
  }

  logout() {
    // will be implemented later
  }
  refreshToken() {
    // will be implemented later
  }
  resendVerificationEmail() {}
  forgotPassword() {}
  resetPassword() {}
}
