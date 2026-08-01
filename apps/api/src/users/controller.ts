import type { AuthRequest } from "../auth/controller";
import { userService } from "../services/service.container";
import type { Request, Response } from "express";

export class UserController {
  constructor() {}

  async me(req: AuthRequest, res: Response) {
    // const
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const response = await userService.getMe({
      userId,
    });

    return res.status(200).json({
      // userProfile: response.userProfile,
    });
  }
  async updateMe(req: AuthRequest, res: Response) {
    const { bio, firstname, lastname, displayName } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }

    const response = await userService.updateMe({
      userId,
      bio,
      firstname,
      lastname,
      displayName,
    });

    return res.status(200).json({
      success: "Profile Updated successfully",
    });
  }
  async updateAvatar(req: AuthRequest, res: Response) {
    const { avatar } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const response = await userService.updateAvatar({
      userId,
      avatar,
    });
  }
  async deleteMe(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const response = await userService.deleteMe({
      userId,
    });

    return res.status(200).json({
      message: "Account Deleted successfully",
    });
  }

  async searchUsers(req: AuthRequest, res: Response) {
    const response = await userService.searchUsers({
      query: req.body.query,
    });
  }
  async getProfile(req: AuthRequest, res: Response) {
    const { username } = req.params;
    if (typeof username !== "string" || !username) {
      return res.status(400).json({
        message: "invalid request",
      });
    }
    const response = await userService.getProfile({ username });
  }
  async checkUsername(req: AuthRequest, res: Response) {
    const { username } = req.params;
    if (typeof username !== "string" || !username) {
      return res.status(400).json({
        message: "invalid request",
      });
    }

    const response = await userService.checkUsername({
      username,
    });
  }
}
