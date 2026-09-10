import { type Request, type Response } from "express";
import type { AuthService } from "./service";
import {
  verifyEmailResponseSchema,
  loginResponseSchema,
  loginChallengeResponseSchema,
  deletedAccountResponseSchema,
  signUpResponseSchema,
  resendVerificationResponseSchema,
  changePasswordResponseSchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
  recoverAccountResponseSchema,
  verifyRecoveryResponseSchema,
  logoutResponseSchema,
  refreshTokenResponseSchema,
  verifyTwoFactorLoginResponseSchema,
  resendTwoFactorLoginResponseSchema,
  setupTwoFactorResponseSchema,
  twoFactorStatusResponseSchema,
  listSessionsResponseSchema,
  revokeSessionResponseSchema,
} from "@bakbak/contracts";
import type {
  ChangePasswordRequestType,
  ForgotPasswordRequestType,
  LoginRequestType,
  RefreshTokenRequestType,
  ResendVerificationRequestType,
  ResetPasswordRequestType,
  SignUpRequestType,
  VerifyEmailRequestType,
  VerifyTwoFactorLoginRequestType,
  ResendTwoFactorLoginRequestType,
  EnableTwoFactorRequestType,
  DisableTwoFactorRequestType,
  RevokeSessionRequestType,
  RecoverAccountRequestType,
  VerifyRecoveryRequestType,
} from "@bakbak/contracts";
import { validateResponse } from "@/middleware/validate";
import { requireSessionId, requireUserId } from "./auth-request";
import { HTTP_STATUS } from "@/errors/app-error";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  signUp = async (req: Request, res: Response) => {
    //bio if left blank will be null. matches db schema.
    // An avatar, when sent, arrives as multipart alongside the fields.
    const response = await this.authService.register(
      req.valid?.body as SignUpRequestType,
      req.file,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      signUpResponseSchema,
      response,
    );
  };

  login = async (req: Request, res: Response) => {
    const response = await this.authService.login(
      req.valid?.body as LoginRequestType,
      req.headers["user-agent"],
    );

    // 2FA on → a challenge instead of tokens (still a 200).
    if ("twoFactorRequired" in response) {
      return validateResponse(
        res,
        HTTP_STATUS.OK,
        loginChallengeResponseSchema,
        response,
      );
    }

    // Soft-deleted account, valid password → tell the owner it's gone and
    // point them at the recovery flow (no tokens ever issued).
    if ("deleted" in response) {
      return validateResponse(
        res,
        HTTP_STATUS.OK,
        deletedAccountResponseSchema,
        response,
      );
    }

    return validateResponse(res, HTTP_STATUS.OK, loginResponseSchema, response);
  };

  verifyTwoFactorLogin = async (req: Request, res: Response) => {
    const response = await this.authService.verifyLoginTwoFactor(
      req.valid?.body as VerifyTwoFactorLoginRequestType,
      req.headers["user-agent"],
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      verifyTwoFactorLoginResponseSchema,
      response,
    );
  };

  resendTwoFactorLogin = async (req: Request, res: Response) => {
    const response = await this.authService.resendLoginTwoFactor(
      req.valid?.body as ResendTwoFactorLoginRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      resendTwoFactorLoginResponseSchema,
      response,
    );
  };

  setupTwoFactor = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const response = await this.authService.requestTwoFactorSetup(userId);

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      setupTwoFactorResponseSchema,
      response,
    );
  };

  enableTwoFactor = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const response = await this.authService.enableTwoFactor(
      userId,
      req.valid?.body as EnableTwoFactorRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      twoFactorStatusResponseSchema,
      response,
    );
  };

  disableTwoFactor = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const response = await this.authService.disableTwoFactor(
      userId,
      req.valid?.body as DisableTwoFactorRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      twoFactorStatusResponseSchema,
      response,
    );
  };

  verifyEmail = async (req: Request, res: Response) => {
    const { token } = req.valid?.body as VerifyEmailRequestType;

    const result = await this.authService.verifyEmail({ token });

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      verifyEmailResponseSchema,
      result,
    );
  };

  resendVerification = async (req: Request, res: Response) => {
    const response = await this.authService.resendVerificationEmail(
      req.valid?.body as ResendVerificationRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      resendVerificationResponseSchema,
      response,
    );
  };

  changePassword = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const response = await this.authService.changePassword(
      userId,
      req.valid?.body as ChangePasswordRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      changePasswordResponseSchema,
      response,
    );
  };

  forgotPassword = async (req: Request, res: Response) => {
    const response = await this.authService.forgotPassword(
      req.valid?.body as ForgotPasswordRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      forgotPasswordResponseSchema,
      response,
    );
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.valid?.body as ResetPasswordRequestType;

    const response = await this.authService.resetPassword({
      token,
      newPassword,
    });

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      resetPasswordResponseSchema,
      response,
    );
  };

  recoverAccount = async (req: Request, res: Response) => {
    const response = await this.authService.recoverAccount(
      req.valid?.body as RecoverAccountRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      recoverAccountResponseSchema,
      response,
    );
  };

  verifyRecovery = async (req: Request, res: Response) => {
    const response = await this.authService.verifyRecovery(
      req.valid?.body as VerifyRecoveryRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      verifyRecoveryResponseSchema,
      response,
    );
  };

  logout = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const result = await this.authService.logout(userId, requireSessionId(req));

    return validateResponse(res, HTTP_STATUS.OK, logoutResponseSchema, result);
  };

  refreshToken = async (req: Request, res: Response) => {
    const result = await this.authService.refreshAccessToken(
      req.valid?.body as RefreshTokenRequestType,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      refreshTokenResponseSchema,
      result,
    );
  };

  listSessions = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const result = await this.authService.listSessions(
      userId,
      req.user?.sessionId,
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      listSessionsResponseSchema,
      result,
    );
  };

  revokeSession = async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { sessionId } = req.valid?.body as RevokeSessionRequestType;

    const result = await this.authService.revokeSession(userId, sessionId);

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      revokeSessionResponseSchema,
      result,
    );
  };

  revokeOtherSessions = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const result = await this.authService.revokeOtherSessions(
      userId,
      requireSessionId(req),
    );

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      revokeSessionResponseSchema,
      result,
    );
  };

  revokeAllSessions = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    const result = await this.authService.revokeAllSessions(userId);

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      revokeSessionResponseSchema,
      result,
    );
  };
}
