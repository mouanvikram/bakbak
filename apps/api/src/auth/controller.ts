import type { Request, Response } from "express";
import { authService } from "../services/service.container";

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

  async changePassword(req: Request, res: Response) {
    // authMiddleware verifies the request before sending it here.
    const response = await authService.changePassword(req.body);

    return res.status(200).json({
      message: response.message,
    });
  }

  async forgotPassword(req: Request, res: Response) {
    // reset password is forgot token;
    await authService.forgotPassword(req.body);

    return res.status(200).json({
      message: "If an account exists, reset link is sent to the email.",
    });
  }

  async resetPassword(req: Request, res: Response) {
    // we are going to valid the password body and token from zod validations later on
    const { token } = req.params;
    const password = req.body.password;
    if (typeof token !== "string") {
      return res.status(400).json({
        message: "Invalid token",
      });
    }

    await authService.resetPassword({
      token,
      password,
    });

    return res.status(200).json({
      message: "Password reset successful",
    });
  }

  async logout(req: Request, res: Response) {}

  async refreshToken(req: Request, res: Response) {}

  async getProfile(req: Request, res: Response) {}
}
