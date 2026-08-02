import type { Request, Response } from "express";
import { authService } from "../services/service.container";
import type { AuthService } from "./service";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username?: string;
    role?: string;
  };
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  signUp = async (req: Request, res: Response) => {
    const user = await this.authService.register(req.body);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      user: user.profile,
    });
  };

  login = async (req: Request, res: Response) => {
    const user = await this.authService.login(req.body);
    return res.status(200).json({
      id: user.id,
      token: user.token,
    });
  };

  verifyEmail = async (req: Request, res: Response) => {
    const token = req.params.token;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Verification token is required",
      });
    }
    const verified = await this.authService.verifyEmail({ token });

    return res.status(200).json({
      email: verified.email,
      message: "Email successfully verified",
    });
  };

  resendVerification = async (req: Request, res: Response) => {
    const response = await this.authService.resendVerificationEmail(req.body);
    return res.status(200).json({
      message: response.message,
    });
  };

  changePassword = async (req: Request, res: Response) => {
    // authMiddleware verifies the request before sending it here.
    const response = await this.authService.changePassword(req.body);

    return res.status(200).json({
      message: response.message,
    });
  };

  forgotPassword = async (req: Request, res: Response) => {
    // reset password is forgot token;
    await this.authService.forgotPassword(req.body);

    return res.status(200).json({
      message: "If an account exists, reset link is sent to the email.",
    });
  };

  resetPassword = async (req: Request, res: Response) => {
    // we are going to valid the password body and token from zod validations later on
    const { token } = req.params;
    const password = req.body.password;
    if (typeof token !== "string") {
      return res.status(400).json({
        message: "Invalid token",
      });
    }

    await this.authService.resetPassword({
      token,
      password,
    });

    return res.status(200).json({
      message: "Password reset successful",
    });
  };

  logout = async (req: Request, res: Response) => {};

  refreshToken = async (req: Request, res: Response) => {};

  getProfile = async (req: Request, res: Response) => {};
}
