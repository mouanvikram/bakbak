import type { Request, Response } from "express";
import { prisma } from "@sealchat/db";
import { loginSchema, signUpSchema } from "./validators";
import { comparePassword, hashPassword } from "../../lib/bcrypt";
import { signToken } from "../../lib/jwt";
import { Resend } from "resend";
import { hashVerificaitonToken, verificationEmail } from "@emails/verify";
import crypto from "crypto";
import { authService, userRepository } from "../services/service.container";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export class AuthController {
  async signUp(req: Request, res: Response) {
    const user = await authService.register(req.body);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      user: user.profile,
    });
  }
  async login(req: Request, res: Response) {
    const user = await authService.login(req.body);
    return res.status(200).json({
      id: user.id,
      token: user.token,
    });
  }
  
  async verifyEmail(req: Request, res: Response) {
    const token = req.query.token;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }
    const verified = await authService.verifyEmail({
      token,
    });

    return res.status(200).json({
      email: verified.email,
      message: "Email successfully verified",
    });
  }
  async resendVerification(req: Request, res: Response) {}
  async changePassword(req: Request, res: Response) {}
}

// GET    /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const token = req.query.token;

    if (typeof token !== "string") {
      return res.status(400).json({
        message: "token invalid",
      });
    }

    const hashedToken = hashVerificaitonToken(token);

    const tokenExists = await prisma.emailVerification.findFirst({
      where: {
        verificationHash: hashedToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
    if (!tokenExists) {
      return res.status(400).json({
        message: "Invalid Token",
      });
    }

    //delete after verification
    await prisma.emailVerification.deleteMany({
      where: {
        userId: tokenExists.userId,
      },
    });

    const updatedUser = await prisma.user.update({
      where: {
        id: tokenExists.userId,
      },
      data: {
        isEmailVerified: true,
      },
    });

    return res.status(200).json({
      email: updatedUser.email,
      message: "Email got verified",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// POST   /api/auth/resend-verification
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    // Don't reveal whether the email exists.
    if (!user) {
      return res.status(200).json({
        message: "If an account exists, a verification email has been sent.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "Email is already verified.",
      });
    }

    await prisma.emailVerification.deleteMany({
      where: {
        userId: user.id,
      },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashVerificaitonToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        verificationHash: hashedToken,
        expiresAt,
      },
    });

    const verificationLink = `${process.env.FRONTEND_URL}/api/auth/verify-email?token=${rawToken}`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "mouanvikram@gmail.com",
      subject: "Verify your email",
      html: verificationEmail(verificationLink, user.username),
    });

    if (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to send verification email.",
      });
    }

    return res.status(200).json({
      message: "Verification email sent successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// POST   /api/auth/change-password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const passwordMatch = await comparePassword(oldPassword, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: {
        email,
      },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
