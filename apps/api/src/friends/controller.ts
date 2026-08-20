import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { FriendService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	acceptFriendRequestResponseSchema,
	cancelFriendRequestResponseSchema,
	getFriendsResponseSchema,
	getPendingRequestsResponseSchema,
	rejectFriendRequestResponseSchema,
	sendFriendRequestResponseSchema,
} from "@bakbak/contracts";

export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  sendRequest = async (req: AuthRequest, res: Response) => {
    const senderId = req.user?.userId;
    const { receiverId } = req.params;
    if (!senderId || !receiverId) {
      return res.status(400).json({
        message: "Invalid Id",
      });
    }
    if (typeof receiverId !== "string") {
      return res.status(400).json({
        message: "Invalid Id",
      });
    }
    const response = await this.friendService.sendRequest({
      senderId,
      receiverId,
    });

    return validateResponse(
      res,
      200,
      sendFriendRequestResponseSchema,
      response,
    );
  };

  cancelRequest = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    if (!requestId || typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid Request",
      });
    }
    const response = await this.friendService.cancelRequest({
      id: requestId,
    });

    return validateResponse(
      res,
      200,
      cancelFriendRequestResponseSchema,
      response,
    );
  };

  acceptRequest = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    if (!requestId || typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid Request",
      });
    }
    const response = await this.friendService.acceptReqeust({
      id: requestId,
    });

    return validateResponse(
      res,
      200,
      acceptFriendRequestResponseSchema,
      response,
    );
  };

  rejectRequest = async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    if (!requestId || typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid Request",
      });
    }
    const response = await this.friendService.rejectRequest({
      id: requestId,
    });

    return validateResponse(
      res,
      200,
      rejectFriendRequestResponseSchema,
      response,
    );
  };

  getFriends = async (req: AuthRequest, res: Response) => {
    const id = req.user?.userId;
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        message: "Invalid",
      });
    }
    const response = await this.friendService.getFriends(id);

    return validateResponse(res, 200, getFriendsResponseSchema, {
      friendships: response,
    });
  };

  getPendingRequest = async (req: AuthRequest, res: Response) => {
    const id = req.user?.userId;
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        message: "Invalid",
      });
    }

    const received = await this.friendService.getIncomingRequests(id);
    const sent = await this.friendService.getOutgoingRequests(id);

    return validateResponse(res, 200, getPendingRequestsResponseSchema, {
      sent,
      received,
    });
  };
  // removeFriend = async (req: AuthRequest, res: Response) => {}
}
