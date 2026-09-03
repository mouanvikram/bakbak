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
import { HTTP_STATUS, AppError, ERROR_CODES } from "@/errors/app-error";

const getString = (value: unknown) =>
	typeof value === "string" && value.trim() ? value.trim() : undefined;

const getLimit = (value: unknown, fallback = 50, max = 100) => {
	const parsed =
		typeof value === "string" ? Number.parseInt(value, 10) : Number(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.min(parsed, max);
};

const getMessageType = (value: unknown) => {
	const type = getString(value)?.toUpperCase() ?? MessageType.TEXT;

	if (!Object.values(MessageType).includes(type as MessageType)) {
		return undefined;
	}

	return type as MessageType;
};

export class MessageController {
	constructor(private readonly messageService: MessageService) {}

	sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const currentUserId = req.user?.userId;
			const chatId = getString(req.params.chatId);
			const type = getMessageType(req.body.type);

			if (!currentUserId || !chatId || !type) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

			const response = await this.messageService.sendMessage({
				currentUserId,
				chatId,
				text: getString(req.body.text),
				type,
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
			const currentUserId = req.user?.userId;
			const chatId = getString(req.params.chatId);

			if (!currentUserId || !chatId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

			const response = await this.messageService.listMessages({
				currentUserId,
				chatId,
				limit: getLimit(req.query.limit),
				cursor: getString(req.query.cursor),
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
			const currentUserId = req.user?.userId;
			const messageId = getString(req.params.messageId);

			if (!currentUserId || !messageId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

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
			const currentUserId = req.user?.userId;
			const messageId = getString(req.params.messageId);
			const text = getString(req.body.text);

			if (!currentUserId || !messageId || !text) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

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
			const currentUserId = req.user?.userId;
			const messageId = getString(req.params.messageId);

			if (!currentUserId || !messageId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

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
			const currentUserId = req.user?.userId;
			const chatId = getString(req.params.chatId);

			if (!currentUserId || !chatId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

			const response = await this.messageService.markChatRead({
				currentUserId,
				chatId,
				messageId: getString(req.body.messageId),
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
			const currentUserId = req.user?.userId;
			const chatId = getString(req.params.chatId);
			const query = getString(req.query.q);

			if (!currentUserId || !chatId || !query) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

			const response = await this.messageService.searchMessages({
				currentUserId,
				chatId,
				query,
				limit: getLimit(req.query.limit),
				cursor: getString(req.query.cursor),
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
			const currentUserId = req.user?.userId;
			const chatId = getString(req.params.chatId);

			if (!currentUserId || !chatId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Invalid request",
				);
			}

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
