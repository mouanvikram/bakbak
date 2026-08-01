import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { FriendService } from "./service";

export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  async sendRequest(req: AuthRequest, res: Response) {}
  async cancelRequest(req: AuthRequest, res: Response) {}
  async acceptRequest(req: AuthRequest, res: Response) {}
  async rejectRequest(req: AuthRequest, res: Response) {}
  async getFriends(req: AuthRequest, res: Response) {}
  async removeFriend(req: AuthRequest, res: Response) {}
  async getPendingRequest(req: AuthRequest, res: Response) {}
}
