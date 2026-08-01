import logger from "@lib/logger";
import type { AuthRequest } from "../auth/controller";
import { userService } from "../services/service.container";
import type { Response } from "express";

export class UserController {
  async getMe(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const profile = await userService.getMe({
      userId,
    });

    return res.status(200).json({
      profile,
    });
  }

  async updateMe(req: AuthRequest, res: Response) {
    const { bio, firstName, lastName, displayName } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }

    const response = await userService.updateMe({
      userId,
      bio,
      firstName,
      lastName,
      displayName,
    });

    return res.status(200).json({
      response,
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

    return res.status(200).json({
      response,
    });
  }

  async deleteMe(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    await userService.deleteMe({
      userId,
    });

    return res.status(200).json({
      message: "Account Deleted successfully",
    });
  }

  async searchUsers(req: AuthRequest, res: Response) {
    const { q } = req.query;
    if (typeof q !== "string") {
      return res.status(400).json({
        message: "Query is required",
      });
    }
    const response = await userService.searchUsers({
      query: q,
    });

    return res.status(200).json({
      users: response.users,
    });
  }

  async getProfile(req: AuthRequest, res: Response) {
    const { username } = req.params;
    if (typeof username !== "string" || !username) {
      return res.status(400).json({
        message: "invalid request",
      });
    }
    const otherUserProfile = await userService.getProfile({ username });

    return res.status(200).json({
      otherUserProfile,
    });
  }

  async checkUsername(req: AuthRequest, res: Response) {
    const username = req.query.username;

    console.log("Username is", username);
    logger.info(username);
    if (typeof username !== "string") {
      return res.status(400).json({
        message: "invalid request",
      });
    }

    const response = await userService.checkUsername({
      username,
    });

    return res.status(200).json({
      response,
    });
  }
}
