import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { FriendService } from "./service";
import { validateResponse } from "../middleware/validate";
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import {
	acceptFriendRequestResponseSchema,
	cancelFriendRequestResponseSchema,
	getFriendsResponseSchema,
	getPendingRequestsResponseSchema,
	rejectFriendRequestResponseSchema,
	sendFriendRequestResponseSchema,
} from "@bakbak/contracts";

const getStringParam = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim().length > 0 ? value : undefined;

export class FriendController {
	constructor(private readonly friendService: FriendService) {}

	sendRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const senderId = req.user?.userId;
			const receiverId = getStringParam(req.params.receiverId);
			if (!senderId || !receiverId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid Id",
				);
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
		} catch (error) {
			next(error);
		}
	};

	cancelRequest = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			const requestId = getStringParam(req.params.requestId);
			if (!userId || !requestId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid Request",
				);
			}
			const response = await this.friendService.cancelRequest({
				requestId,
				userId,
			});

			return validateResponse(
				res,
				200,
				cancelFriendRequestResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	acceptRequest = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			const requestId = getStringParam(req.params.requestId);
			if (!userId || !requestId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid Request",
				);
			}
			const response = await this.friendService.acceptRequest({
				requestId,
				userId,
			});

			return validateResponse(
				res,
				200,
				acceptFriendRequestResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	rejectRequest = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = req.user?.userId;
			const requestId = getStringParam(req.params.requestId);
			if (!userId || !requestId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid Request",
				);
			}
			const response = await this.friendService.rejectRequest({
				requestId,
				userId,
			});

			return validateResponse(
				res,
				200,
				rejectFriendRequestResponseSchema,
				response,
			);
		} catch (error) {
			next(error);
		}
	};

	getFriends = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?.userId;
			if (!userId) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Unauthorized",
				);
			}
			const response = await this.friendService.getFriends({ userId });

			return validateResponse(res, 200, getFriendsResponseSchema, {
				friendships: response,
			});
		} catch (error) {
			next(error);
		}
	};

	getPendingRequest = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const id = req.user?.userId;
			if (!id) {
				throw new AppError(
					HTTP_STATUS.UNAUTHORIZED,
					ERROR_CODES.UNAUTHORIZED,
					"Unauthorized",
				);
			}

			const received = await this.friendService.getIncomingRequests(id);
			const sent = await this.friendService.getOutgoingRequests(id);

			return validateResponse(res, 200, getPendingRequestsResponseSchema, {
				sent,
				received,
			});
		} catch (error) {
			next(error);
		}
	};

	removeFriend = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {};
}
