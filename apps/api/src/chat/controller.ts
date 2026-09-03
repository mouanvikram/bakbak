import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { ChatService } from "./service";
import { validateResponse } from "../middleware/validate";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import {
	addParticipantResponseSchema,
	createChatResponseSchema,
	deleteChatResponseSchema,
	getChatResponseSchema,
	listChatsResponseSchema,
	removeParticipantResponseSchema,
	updateChatResponseSchema,
} from "@bakbak/contracts";
import type {
	AddParticipantRequestType,
	ChatIdParamsType,
	ChatMemberParamsType,
	CreateChatRequestType,
	ListChatsQueryType,
	UpdateChatRequestType,
} from "@bakbak/contracts";

/** Every chat route runs `authMiddleware`, so this is always set in practice. */
function requireUserId(req: AuthRequest): string {
	const userId = req.user?.userId;
	if (!userId) {
		throw new AppError(
			HTTP_STATUS.UNAUTHORIZED,
			ERROR_CODES.UNAUTHORIZED,
			"Not authenticated",
		);
	}
	return userId;
}

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
					});

		return validateResponse(res, 201, createChatResponseSchema, response);
	};

	getChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const response = await this.chatService.getChat({ currentUserId, chatId });

		return validateResponse(res, 200, getChatResponseSchema, response);
	};

	listChats = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { limit, cursor } = req.valid?.query as ListChatsQueryType;

		const response = await this.chatService.listChats({
			currentUserId,
			limit,
			cursor,
		});

		return validateResponse(res, 200, listChatsResponseSchema, {
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
		});

		return validateResponse(res, 200, updateChatResponseSchema, response);
	};

	deleteChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const response = await this.chatService.deleteChat({ currentUserId, chatId });

		return validateResponse(res, 200, deleteChatResponseSchema, response);
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

		return validateResponse(res, 200, addParticipantResponseSchema, response);
	};

	removeParticipant = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId, userId } = req.valid?.params as ChatMemberParamsType;

		const response = await this.chatService.removeParticipant({
			currentUserId,
			chatId,
			participantId: userId,
		});

		return validateResponse(res, 200, removeParticipantResponseSchema, response);
	};
}
