import logger from "@lib/logger";
import type { AuthRequest } from "../auth/controller";
import type { Response } from "express";
import type { UserService } from "./service";

export class UserController {
  constructor(private readonly userService: UserService) {}

  getMe = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const profile = await this.userService.getMe({
      userId,
    });

    return res.status(200).json({
      profile,
    });
  };

  updateMe = async (req: AuthRequest, res: Response) => {
    const { bio, firstName, lastName, displayName } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }

    const response = await this.userService.updateMe({
      userId,
      bio,
      firstName,
      lastName,
      displayName,
    });

    return res.status(200).json({
      response,
    });
  };

  updateAvatar = async (req: AuthRequest, res: Response) => {
    const { avatar } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    const response = await this.userService.updateAvatar({
      userId,
      avatar,
    });

    return res.status(200).json({
      response,
    });
  };

  deleteMe = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Enter a valid user id",
      });
    }
    await this.userService.deleteMe({
      userId,
    });

    return res.status(200).json({
      message: "Account Deleted successfully",
    });
  };

  searchUsers = async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    if (typeof q !== "string") {
      return res.status(400).json({
        message: "Query is required",
      });
    }
    const response = await this.userService.searchUsers({
      query: q,
    });

    return res.status(200).json({
      users: response.users,
    });
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    const { username } = req.params;
    if (typeof username !== "string" || !username) {
      return res.status(400).json({
        message: "invalid request",
      });
    }
    const otherUserProfile = await this.userService.getProfile({ username });

    return res.status(200).json({
      otherUserProfile,
    });
  };

  checkUsername = async (req: AuthRequest, res: Response) => {
    const username = req.query.username;

    console.log("Username is", username);
    logger.info(username);
    if (typeof username !== "string") {
      return res.status(400).json({
        message: "invalid request",
      });
    }

    const response = await this.userService.checkUsername({
      username,
    });

    return res.status(200).json({
      response,
    });
  };
}
