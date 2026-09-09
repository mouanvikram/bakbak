import type { Response } from "express";
import { requireUserId, type AuthRequest } from "@/auth/auth-request";
import type { FriendService } from "./service";
import { validateResponse } from "@/middleware/validate";
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
import { HTTP_STATUS } from "@/errors/app-error";
import type {
	FriendIdParamsType,
	FriendRequestIdParamsType,
	SendFriendRequestRequestType,
} from "@bakbak/contracts";

export class FriendController {
	constructor(private readonly friendService: FriendService) {}

	sendRequest = async (req: AuthRequest, res: Response) => {
		const senderId = requireUserId(req);
		const { receiverId } = req.valid?.params as SendFriendRequestRequestType;

		const response = await this.friendService.sendRequest({
			senderId,
			receiverId,
		});

		return validateResponse(res, HTTP_STATUS.OK, sendFriendRequestResponseSchema, response);
	};

	cancelRequest = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { requestId } = req.valid?.params as FriendRequestIdParamsType;

		const response = await this.friendService.cancelRequest({
			requestId,
			userId,
		});

		return validateResponse(
			res,
			HTTP_STATUS.OK,
			cancelFriendRequestResponseSchema,
			response,
		);
	};

	acceptRequest = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { requestId } = req.valid?.params as FriendRequestIdParamsType;

		const response = await this.friendService.acceptRequest({
			requestId,
			userId,
		});

		return validateResponse(
			res,
			HTTP_STATUS.OK,
			acceptFriendRequestResponseSchema,
			response,
		);
	};

	rejectRequest = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { requestId } = req.valid?.params as FriendRequestIdParamsType;

		const response = await this.friendService.rejectRequest({
			requestId,
			userId,
		});

		return validateResponse(
			res,
			HTTP_STATUS.OK,
			rejectFriendRequestResponseSchema,
			response,
		);
	};

	getFriends = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.friendService.getFriends({ userId });

		return validateResponse(res, HTTP_STATUS.OK, getFriendsResponseSchema, {
			friendships: response,
		});
	};

	getPendingRequest = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const received = await this.friendService.getIncomingRequests(userId);
		const sent = await this.friendService.getOutgoingRequests(userId);

		return validateResponse(res, HTTP_STATUS.OK, getPendingRequestsResponseSchema, {
			sent,
			received,
		});
	};

	removeFriend = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);
		const { friendId } = req.valid?.params as FriendIdParamsType;

		const response = await this.friendService.removeFriend({
			requestId: friendId,
			userId,
		});

		return validateResponse(res, HTTP_STATUS.OK, removeFriendResponseSchema, response);
	};

	getSuggestions = async (req: AuthRequest, res: Response) => {
		const userId = requireUserId(req);

		const response = await this.friendService.getSuggestions({ userId });

		return validateResponse(res, HTTP_STATUS.OK, getSuggestionsResponseSchema, response);
	};
}
