import type { Request, Response } from "express";
import { prisma } from "@sealchat/db";
import { loginSchema, signUpSchema } from "./auth.schema";
import { comparePassword, hashPassword } from "../../lib/bcrypt";
import { signToken } from "../../lib/jwt";
import { Resend } from "resend";
import {
  hashVerificaitonToken,
  verificationEmail,
} from "../../lib/verify.email.template";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const signUp = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = signUpSchema.parse(req.body);

    const emailExists = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (emailExists) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const userExists = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (userExists) {
      return res.status(409).json({
        message: "Username already exists",
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: passwordHash,
      },
    });

    //sending the user an email for verification
    const email_token = crypto.randomBytes(32).toHex();
    const hashToken = hashVerificaitonToken(email_token);

    //check if there were previous emails sent
    await prisma.emailVerification.deleteMany({
      where: {
        userId: user.id,
      },
    });

    //set expiration at 15 mins.
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); //15 minutes

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        verificationHash: hashToken,
        expiresAt,
      },
    });

    console.log("Email verification link sent");

    const verificationLink =
      `${process.env.FRONTEND_URL}/api/auth/verify-email?` +
      new URLSearchParams({
        token: email_token,
      });
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "mouanvikram@gmail.com",
      subject: "Email Verification Link",
      html: verificationEmail(verificationLink, user.username),
    });

    if (error) {
      throw error;
      return;
    }

    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Verify your email first.",
      });
    }

    const passwordMatch = await comparePassword(password, user?.passwordHash!);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = await signToken(user.id);

    return res.status(200).json({
      id: user.id,
      email: user.email,
      username: user.username,
      isEmailVerified: user.isEmailVerified,
      token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
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
