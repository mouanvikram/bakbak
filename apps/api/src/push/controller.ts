import type { Request, Response } from "express";
import { requireUserId } from "@/auth/auth-request";
import { validateResponse } from "@/middleware/validate";
import {
  pushConfigResponseSchema,
  pushSubscribeResponseSchema,
  type PushSubscriptionRequestType,
} from "@bakbak/contracts";
import { HTTP_STATUS } from "@/errors/app-error";
import type { PushService } from "./service";
import { pushConfig } from "./config";

export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** VAPID public key for the browser to subscribe with (null = not configured). */
  getConfig = async (_req: Request, res: Response) => {
    return validateResponse(res, HTTP_STATUS.OK, pushConfigResponseSchema, {
      publicKey: pushConfig.enabled ? pushConfig.publicKey : null,
    });
  };

  subscribe = async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = req.valid?.body as PushSubscriptionRequestType;

    const response = await this.pushService.subscribe({
      userId,
      subscription: body,
      userAgent: req.headers["user-agent"],
    });

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      pushSubscribeResponseSchema,
      response,
    );
  };

  unsubscribe = async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = req.valid?.body as PushSubscriptionRequestType;

    const response = await this.pushService.unsubscribe({
      userId,
      subscription: body,
    });

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      pushSubscribeResponseSchema,
      response,
    );
  };
}