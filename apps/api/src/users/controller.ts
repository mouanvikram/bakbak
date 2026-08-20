import logger from "@lib/logger";
import type { AuthRequest } from "../auth/controller";
import type { Response } from "express";
import type { UserService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	checkUsernameResponseSchema,
	deleteMeResponseSchema,
	getMeResponseSchema,
	getProfileResponseSchema,
	searchUsersResponseSchema,
	updateAvatarResponseSchema,
	updateProfileResponseSchema,
} from "@bakbak/contracts";

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

    return validateResponse(res, 200, getMeResponseSchema, {
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

    return validateResponse(res, 200, updateProfileResponseSchema, response);
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

    return validateResponse(res, 200, updateAvatarResponseSchema, response);
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

    return validateResponse(res, 200, deleteMeResponseSchema, {
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

    return validateResponse(res, 200, searchUsersResponseSchema, response);
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    const { username } = req.params;
    if (typeof username !== "string" || !username) {
      return res.status(400).json({
        message: "invalid request",
      });
    }
    const otherUserProfile = await this.userService.getProfile({ username });

    return validateResponse(res, 200, getProfileResponseSchema, {
      ...otherUserProfile,
      username,
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

    return validateResponse(res, 200, checkUsernameResponseSchema, response);
  };
}
