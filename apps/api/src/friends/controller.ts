import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { FriendService } from "./service";
import { validateResponse } from "../middleware/validate";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import {
	acceptFriendRequestResponseSchema,
	cancelFriendRequestResponseSchema,
	getFriendsResponseSchema,
	getPendingRequestsResponseSchema,
	getSuggestionsResponseSchema,
	rejectFriendRequestResponseSchema,
	removeFriendResponseSchema,
	sendFriendRequestResponseSchema,
} from "@bakbak/contracts";
import type {
	FriendIdParamsType,
	FriendRequestIdParamsType,
	SendFriendRequestRequestType,
} from "@bakbak/contracts";

/** Every friend route runs `authMiddleware`, so this is always set in practice. */
function requireUserId(req: AuthRequest): string {
	const userId = req.user?.userId;
	if (!userId) {
		throw new AppError(
			HTTP_STATUS.UNAUTHORIZED,
			ERROR_CODES.UNAUTHORIZED,
			"Unauthorized",
		);
	}
	return userId;
}

export class FriendController {
	constructor(private readonly friendService: FriendService) {}

	sendRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const senderId = requireUserId(req);
			const { receiverId } = req.valid?.params as SendFriendRequestRequestType;

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
			const userId = requireUserId(req);
			const { requestId } = req.valid?.params as FriendRequestIdParamsType;
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
			const userId = requireUserId(req);
			const { requestId } = req.valid?.params as FriendRequestIdParamsType;
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
			const userId = requireUserId(req);
			const { requestId } = req.valid?.params as FriendRequestIdParamsType;
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
			const userId = requireUserId(req);
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
			const id = requireUserId(req);

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
	) => {
		try {
			const userId = requireUserId(req);
			const { friendId } = req.valid?.params as FriendIdParamsType;

			const response = await this.friendService.removeFriend({
				requestId: friendId,
				userId,
			});

			return validateResponse(res, 200, removeFriendResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	getSuggestions = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const userId = requireUserId(req);

			const response = await this.friendService.getSuggestions({ userId });

			return validateResponse(res, 200, getSuggestionsResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};
}
