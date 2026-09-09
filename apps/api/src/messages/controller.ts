import { MessageType } from "@bakbak/contracts";
import type { Response } from "express";
import { requireUserId, type AuthRequest } from "../auth/auth-request";
import type { MessageService } from "./service";
import { validateResponse } from "../middleware/validate";
import {
	deleteMessageResponseSchema,
	editMessageResponseSchema,
	getMessageResponseSchema,
	listMessagesResponseSchema,
	markChatReadResponseSchema,
	searchMessagesResponseSchema,
	sendMessageResponseSchema,
	getUnreadCountResponseSchema,
} from "@bakbak/contracts";
import type {
	ChatIdParamsType,
	EditMessageRequestType,
	GetMessageRequestType,
	ListMessagesQueryType,
	MarkChatReadRequestType,
	SearchMessagesQueryType,
	SendMessageRequestType,
} from "@bakbak/contracts";

export class MessageController {
	constructor(private readonly messageService: MessageService) {}

	sendMessage = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const body = req.valid?.body as SendMessageRequestType;

		const response = await this.messageService.sendMessage({
			currentUserId,
			chatId,
			text: body.text,
			type: body.type ?? MessageType.TEXT,
			attachmentIds: body.attachmentIds,
			clientId: body.clientId,
		});

		return validateResponse(res, 201, sendMessageResponseSchema, response);
	};

	listMessages = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const { limit, cursor } = req.valid?.query as ListMessagesQueryType;

		const response = await this.messageService.listMessages({
			currentUserId,
			chatId,
			limit,
			cursor,
		});

		return validateResponse(res, 200, listMessagesResponseSchema, {
			messages: response,
		});
	};

	getMessage = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { messageId } = req.valid?.params as GetMessageRequestType;

		const response = await this.messageService.getMessage({
			currentUserId,
			messageId,
		});

		return validateResponse(res, 200, getMessageResponseSchema, {
			message: response,
		});
	};

	editMessage = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { messageId } = req.valid?.params as GetMessageRequestType;
		const { text } = req.valid?.body as EditMessageRequestType;

		const response = await this.messageService.editMessage({
			currentUserId,
			messageId,
			text,
		});

		return validateResponse(res, 200, editMessageResponseSchema, response);
	};

	deleteMessage = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { messageId } = req.valid?.params as GetMessageRequestType;

		const response = await this.messageService.deleteMessage({
			currentUserId,
			messageId,
		});

		return validateResponse(res, 200, deleteMessageResponseSchema, response);
	};

	markChatRead = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const { messageId } = req.valid?.body as MarkChatReadRequestType;

		const response = await this.messageService.markChatRead({
			currentUserId,
			chatId,
			messageId,
		});

		return validateResponse(res, 200, markChatReadResponseSchema, response);
	};

	searchMessages = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;
		const { q, limit, cursor } = req.valid?.query as SearchMessagesQueryType;

		const response = await this.messageService.searchMessages({
			currentUserId,
			chatId,
			query: q,
			limit,
			cursor,
		});

		return validateResponse(res, 200, searchMessagesResponseSchema, {
			messages: response,
		});
	};

	getUnreadCount = async (req: AuthRequest, res: Response) => {
		const currentUserId = requireUserId(req);
		const { chatId } = req.valid?.params as ChatIdParamsType;

		const count = await this.messageService.getUnreadCount({
			currentUserId,
			chatId,
		});

		return validateResponse(res, 200, getUnreadCountResponseSchema, {
			count,
		});
	};
}
