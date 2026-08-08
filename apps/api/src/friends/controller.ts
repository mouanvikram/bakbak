import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { FriendService } from "./service";

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
    console.log(senderId,receiverId);
    const response = await this.friendService.sendRequest({
      senderId,
      receiverId,
    });

    return res.status(200).json({
      response,
    });
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

    return res.status(200).json({
      response,
    });
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

    return res.status(200).json({
      response,
    });
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

    return res.status(200).json({
      response,
    });
  };

  getFriends = async (req: AuthRequest, res: Response) => {
    const id = req.user?.userId;
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        message: "Invalid",
      });
    }
    const response = await this.friendService.getFriends(id);

    return res.status(200).json({
      response,
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

    return res.status(200).json({
      sent,
      received,
    });
  };
  // removeFriend = async (req: AuthRequest, res: Response) => {}
}
