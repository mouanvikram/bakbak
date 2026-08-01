import type { AuthRequest } from "../auth/controller";
import type { NextFunction, Response } from "express";
import { jwtService } from "../services/service.container";
import type { AccessTokenPayload } from "../auth/jwt.service";

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeaders = req.headers.authorization;

    if (!authHeaders || !authHeaders.startsWith("Bearer")) {
      return res.status(401).json({
        error: "Invalid Request",
      });
    }
    const token = authHeaders.split(" ")[1];
    const payload = jwtService.verifyJwt<AccessTokenPayload>(token as string);

    req.user = {
      userId: payload.sub,
    };

    next();
  } catch (error: any) {
    throw new Error(error);
  }
};
