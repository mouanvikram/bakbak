import { MessageType } from "@bakbak/contracts";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../auth/controller";
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
import { HTTP_STATUS, AppError, ERROR_CODES } from "@/errors/app-error";

/** Every message route runs `authMiddleware`, so this is always set in practice. */
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

export class MessageController {
	constructor(private readonly messageService: MessageService) {}

	sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const currentUserId = requireUserId(req);
			const { chatId } = req.valid?.params as ChatIdParamsType;
			const body = req.valid?.body as SendMessageRequestType;

			const response = await this.messageService.sendMessage({
				currentUserId,
				chatId,
				text: body.text,
				type: body.type ?? MessageType.TEXT,
				attachmentIds: body.attachmentIds,
			});

			return validateResponse(res, 201, sendMessageResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	listMessages = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
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
		} catch (error) {
			next(error);
		}
	};

	getMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const currentUserId = requireUserId(req);
			const { messageId } = req.valid?.params as GetMessageRequestType;

			const response = await this.messageService.getMessage({
				currentUserId,
				messageId,
			});

			return validateResponse(res, 200, getMessageResponseSchema, {
				message: response,
			});
		} catch (error) {
			next(error);
		}
	};

	editMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const currentUserId = requireUserId(req);
			const { messageId } = req.valid?.params as GetMessageRequestType;
			const { text } = req.valid?.body as EditMessageRequestType;

			const response = await this.messageService.editMessage({
				currentUserId,
				messageId,
				text,
			});

			return validateResponse(res, 200, editMessageResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	deleteMessage = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const currentUserId = requireUserId(req);
			const { messageId } = req.valid?.params as GetMessageRequestType;

			const response = await this.messageService.deleteMessage({
				currentUserId,
				messageId,
			});

			return validateResponse(res, 200, deleteMessageResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	markChatRead = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const currentUserId = requireUserId(req);
			const { chatId } = req.valid?.params as ChatIdParamsType;
			const { messageId } = req.valid?.body as MarkChatReadRequestType;

			const response = await this.messageService.markChatRead({
				currentUserId,
				chatId,
				messageId,
			});

			return validateResponse(res, 200, markChatReadResponseSchema, response);
		} catch (error) {
			next(error);
		}
	};

	searchMessages = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
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
		} catch (error) {
			next(error);
		}
	};

	getUnreadCount = async (
		req: AuthRequest,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const currentUserId = requireUserId(req);
			const { chatId } = req.valid?.params as ChatIdParamsType;

			const count = await this.messageService.getUnreadCount({
				currentUserId,
				chatId,
			});

			return validateResponse(res, 200, getUnreadCountResponseSchema, {
				count,
			});
		} catch (error) {
			next(error);
		}
	};
}
