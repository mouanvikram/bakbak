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
	createDirectChatRequestSchema,
	createGroupChatRequestSchema,
} from "@bakbak/contracts";

const getString = (
	value: unknown, 
) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const getStringArray = (value: unknown) => {
	
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
};

const getLimit = (value: unknown, fallback = 30, max = 100) => {
	
	const parsed =
		typeof value === "string" ? Number.parseInt(value, 10) : Number(value);

	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.min(parsed, max);
};

export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	createChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatType = getString(req.body.type)?.toUpperCase();

		if (!currentUserId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid user",
			);
		}

		if (!chatType || !["DIRECT", "GROUP"].includes(chatType)) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid chat type",
			);
		}

		let response;
		if (chatType === "DIRECT") {
			const participantId =
				getString(req.body.participantId) ??
				getString(req.body.receiverId) ??
				getString(req.body.userId);

			if (!participantId) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Participant id is required",
				);
			}

			const directValidation = createDirectChatRequestSchema.safeParse({
				type: chatType,
				participantId,
			});

			if (!directValidation.success) {
				return res.status(400).json({
					error: {
						code: ERROR_CODES.VALIDATION_ERROR,
						message: "Validation failed",
						details: directValidation.error.issues,
					},
				});
			}

			response = await this.chatService.createDirectChat({
				currentUserId,
				participantId,
			});
		} else {
			const name = getString(req.body.name);
			const participantIds =
				getStringArray(req.body.participantIds).length > 0
					? getStringArray(req.body.participantIds)
					: getStringArray(req.body.memberIds);

			if (!name || participantIds.length === 0) {
				throw new AppError(
					HTTP_STATUS.BAD_REQUEST,
					ERROR_CODES.VALIDATION_ERROR,
					"Group name and participant ids are required",
				);
			}

			const groupValidation = createGroupChatRequestSchema.safeParse({
				name,
				participantIds,
				avatar: getString(req.body.avatar),
			});

			if (!groupValidation.success) {
				return res.status(400).json({
					error: {
						code: ERROR_CODES.VALIDATION_ERROR,
						message: "Validation failed",
						details: groupValidation.error.issues,
					},
				});
			}

			response = await this.chatService.createGroupChat({
				currentUserId,
				name,
				participantIds,
				avatar: getString(req.body.avatar),
			});
		}

		return validateResponse(res, 201, createChatResponseSchema, response);
	};

	getChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatId = getString(req.params.chatId);

		if (!currentUserId || !chatId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid request",
			);
		}

		const response = await this.chatService.getChat({
			currentUserId,
			chatId,
		});

		return validateResponse(res, 200, getChatResponseSchema, response);
	};

	listChats = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;

		if (!currentUserId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid user",
			);
		}

		const response = await this.chatService.listChats({
			currentUserId,
			limit: getLimit(req.query.limit),
			cursor: getString(req.query.cursor),
		});

		return validateResponse(res, 200, listChatsResponseSchema, {
			chats: response,
		});
	};

	updateChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatId = getString(req.params.chatId);

		if (!currentUserId || !chatId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid request",
			);
		}

		const response = await this.chatService.updateChat({
			currentUserId,
			chatId,
			name: getString(req.body.name),
			avatar: req.body.avatar === null ? null : getString(req.body.avatar),
		});

		return validateResponse(res, 200, updateChatResponseSchema, response);
	};

	deleteChat = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatId = getString(req.params.chatId);

		if (!currentUserId || !chatId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid request",
			);
		}

		const response = await this.chatService.deleteChat({
			currentUserId,
			chatId,
		});

		return validateResponse(res, 200, deleteChatResponseSchema, response);
	};

	addParticipant = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatId = getString(req.params.chatId);
		const participantId =
			getString(req.body.participantId) ??
			getString(req.body.userId) ??
			getString(req.body.memberId);

		if (!currentUserId || !chatId || !participantId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid request",
			);
		}

		const response = await this.chatService.addParticipant({
			currentUserId,
			chatId,
			participantId,
		});

		return validateResponse(res, 200, addParticipantResponseSchema, response);
	};

	removeParticipant = async (req: AuthRequest, res: Response) => {
		const currentUserId = req.user?.userId;
		const chatId = getString(req.params.chatId);
		const userId = getString(req.params.userId);

		if (!currentUserId || !chatId || !userId) {
			throw new AppError(
				HTTP_STATUS.BAD_REQUEST,
				ERROR_CODES.VALIDATION_ERROR,
				"Invalid request",
			);
		}

		const response = await this.chatService.removeParticipant({
			currentUserId,
			chatId,
			participantId: userId,
		});

		return validateResponse(
			res,
			200,
			removeParticipantResponseSchema,
			response,
		);
	};
}
