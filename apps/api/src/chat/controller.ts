import type { Response } from "express";
import { requireUserId, type AuthRequest } from "../auth/auth-request";
import type { ChatService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	addParticipantResponseSchema,
	createChatResponseSchema,
	deleteChatResponseSchema,
	getChatResponseSchema,
	leaveChatResponseSchema,
	listChatsResponseSchema,
	removeParticipantResponseSchema,
	updateChatResponseSchema,
	updateChatParticipantResponseSchema,
} from "@bakbak/contracts";
import { HTTP_STATUS } from "@/errors/app-error";
import type {
	AddParticipantRequestType,
	ChatIdParamsType,
	ChatMemberParamsType,
	CreateChatRequestType,
	ListChatsQueryType,
	UpdateChatParticipantRequestType,
	UpdateChatRequestType,
} from "@bakbak/contracts";

export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	createChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const body = req.valid?.body as CreateChatRequestType;

		const response =
			body.type === "DIRECT"
				? await this.chatService.createDirectChat({
						currentUserId,
						participantId: body.participantId,
					})
				: await this.chatService.createGroupChat({
						currentUserId,
						name: body.name,
						participantIds: body.participantIds,
						avatar: body.avatar,
						description: body.description,
					});

		return validateResponse(res, HTTP_STATUS.CREATED, createChatResponseSchema, response);
	};

	getChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const response = await this.chatService.getChat({ currentUserId, chatId });

		return validateResponse(res, HTTP_STATUS.OK, getChatResponseSchema, response);
	};

	listChats = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { limit, cursor } = req.valid?.query as ListChatsQueryType;

		const response = await this.chatService.listChats({
			currentUserId,
			limit,
			cursor,
		});

		return validateResponse(res, HTTP_STATUS.OK, listChatsResponseSchema, {
			chats: response,
		});
	};

	updateChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const body = req.valid?.body as UpdateChatRequestType;

		const response = await this.chatService.updateChat({
			currentUserId,
			chatId,
			name: body.name,
			avatar: body.avatar,
			description: body.description,
		});

		return validateResponse(res, HTTP_STATUS.OK, updateChatResponseSchema, response);
	};

	deleteChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const response = await this.chatService.deleteChat({ currentUserId, chatId });

		return validateResponse(res, HTTP_STATUS.OK, deleteChatResponseSchema, response);
	};

	leaveChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const response = await this.chatService.leaveChat({ currentUserId, chatId });

		return validateResponse(res, HTTP_STATUS.OK, leaveChatResponseSchema, response);
	};

	addParticipant = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const { participantId } = req.valid?.body as AddParticipantRequestType;

		const response = await this.chatService.addParticipant({
			currentUserId,
			chatId,
			participantId,
		});

		return validateResponse(res, HTTP_STATUS.OK, addParticipantResponseSchema, response);
	};

	updateParticipantSettings = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const body = req.valid?.body as UpdateChatParticipantRequestType;

		const response = await this.chatService.updateParticipantSettings({
			currentUserId,
			chatId,
			mutedUntil: body.mutedUntil,
			isPinned: body.isPinned,
			isArchived: body.isArchived,
		});

		return validateResponse(
			res,
			HTTP_STATUS.OK,
			updateChatParticipantResponseSchema,
			response,
		);
	};

	removeParticipant = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId, userId } = req.valid?.params as ChatMemberParamsType;

		const response = await this.chatService.removeParticipant({
			currentUserId,
			chatId,
			participantId: userId,
		});

		return validateResponse(res, HTTP_STATUS.OK, removeParticipantResponseSchema, response);
	};
}
