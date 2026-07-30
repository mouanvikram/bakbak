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
    const token = req.params.token;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }
    const verified = await authService.verifyEmail({ token });

    return res.status(200).json({
      email: verified.email,
      message: "Email successfully verified",
    });
  }

  async resendVerification(req: Request, res: Response) {
    const response = await authService.resendVerificationEmail(req.body);
    return res.status(200).json({
      message: response.message,
    });
  }

  async forgotPassword(req: Request, res: Response) {
    // reset password is forgot token;
  }

  async changePassword(req: Request, res: Response) {
    // checks the token
    // middleware of jwt token
  }
}




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
