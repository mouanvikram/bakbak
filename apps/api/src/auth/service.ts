import type { JwtService } from "./jwt.service";
import type { PasswordService } from "./pwd.service";
import type { UserRepository } from "../users/repository";
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  VerfiyEmailType,
} from "./types";
import type { EmailService } from "./email.service";
import { prisma } from "@sealchat/db";
import crypto from "crypto";
import logger from "@logger";
import type { EmailRepository } from "./email.repository";
import { comparePassword, hashPassword } from "@lib/bcrypt";
import { password } from "bun";

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
    try {
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
      const hasedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const url = `http://localhost:3000/api/auth/verify-email/${token}`;

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
    } catch (error) {
      throw new Error("something went wrong");
    }
  }

  async login(dto: LoginDto) {
    try {
      const userExists = await this.userRepository.findFirst({
        OR: [{ username: dto.identifier }, { email: dto.identifier }],
      });
      if (!userExists) {
        throw new Error("Email/Username does not exits");
      }

      if (!userExists.isEmailVerified) {
        throw new Error("Email is not verified");
      }

      const matches = await this.pwdService.verify(
        dto.password,
        userExists.passwordHash,
      );

      if (!matches) {
        throw new Error("Password is wrong");
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
    } catch (error) {
      logger.error(error);
      throw new Error("Something went wrong");
    }
  }

  async verifyEmail(dto: VerfiyEmailType) {
    try {
      const token = dto.token;
      if (typeof token !== "string") {
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
        logger.error("Token does not exits");
        throw new Error("token does not exits");
      }

      const user = await this.userRepository.updateBy(
        {
          id: emailVerification?.userId,
        },
        {
          isEmailVerified: true,
        },
      );
      await this.emailRepository.deleteAll({
        userId: emailVerification.userId,
      });

      return {
        email: user.email,
      };
    } catch (error) {
      logger.error(error);
      throw new Error("Internal Server error 500");
    }
  }

  async resendVerificationEmail(dto: { email: string }) {
    const email = dto.email;
    if (!email) {
      throw new Error("enter a valid email");
    }

    const user = await this.userRepository.findBy({
      email,
    });

    if (!user) {
      //we should return a success response.
      // saying if a email exits. verification link has been sent to that email.
      throw new Error("Email does not exits");
    }

    if (user.isEmailVerified) {
      throw new Error("Email already verified");
    }
    await this.emailRepository.deleteAll({
      userId: user.id,
    });

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await this.emailRepository.create({
      verificationHash: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    const url = `${process.env.FRONTEND_URL}/api/auth/verify-email/${token}`;
    await this.emailService.sendVerificationEmail({
      email,
      url,
    });

    return {
      message: "Email sent successfully",
    };
  }

  logout() {
    // will be implemented later
  }
  refreshToken() {
    // will be implemented later
  }
  forgotPassword() {
    // change password on clicking forgot password.
  }
  async changePassword(dto: ChangePasswordDto) {
    // change password while user is logged in.
    // const {email,oldPassword, newPassword} = user
    const userExists = await this.userRepository.findBy({
      email: dto.email,
    });
    if (!userExists) {
      throw new Error("Email/Username does not exits");
    }

    if (!userExists.isEmailVerified) {
      throw new Error("Email is not verified");
    }

    const matches = await this.pwdService.verify(
      dto.oldPassword,
      userExists.passwordHash,
    );

    if (!matches) {
      throw new Error("Credentials does not matches");
    }

    const newHash = await this.pwdService.hash(dto.newPassword);
    const user = await this.userRepository.updateBy(
      {
        email: dto.email,
      },
      {
        passwordHash: newHash,
      },
    );

    return {
      message: "Password changed successfully",
    };
  }
}
