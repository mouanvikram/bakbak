import type { Request, Response } from "express";
import { requireUserId } from "@/auth/auth-request";
import { validateResponse } from "@/middleware/validate";
import {
  callHistoryResponseSchema,
  iceServersResponseSchema,
} from "@bakbak/contracts";
import { HTTP_STATUS } from "@/errors/app-error";
import type { CallsService } from "./service";

export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  /** STUN/TURN servers for the browser, with short-lived TURN credentials. */
  getIceServers = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      iceServersResponseSchema,
      this.callsService.getIceServers(userId),
    );
  };

  /** Recent calls in both directions, newest first — the Calls tab. */
  getHistory = async (req: Request, res: Response) => {
    const userId = requireUserId(req);

    return validateResponse(
      res,
      HTTP_STATUS.OK,
      callHistoryResponseSchema,
      await this.callsService.getHistory(userId),
    );
  };
}
