import type { AuthRequest } from "../auth/controller";
import type { NextFunction, Response } from "express";
import { jwtService } from "../services/service.container";
import type { AccessTokenPayload } from "../helpers/jwt.service";
import logger from "@lib/logger";

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeaders = req.headers.authorization;

    if (!authHeaders || !authHeaders.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid Request",
      });
    }
    const token = authHeaders.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        message: "Missing Token",
      });
    }

    const payload = jwtService.verifyJwt<AccessTokenPayload>(token);

    req.user = {
      userId: payload.sub,
    };

    next();
  } catch (error: any) {
    logger.error(error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
