import { MessageType } from "@sealchat/db"; //modified
import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { MessageService } from "./service"; //modified

const getString = (value: unknown) => //modified
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getLimit = (value: unknown, fallback = 50, max = 100) => { //modified
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const getMessageType = (value: unknown) => { //modified
  const type = getString(value)?.toUpperCase() ?? MessageType.TEXT;

  if (!Object.values(MessageType).includes(type as MessageType)) {
    return undefined;
  }

  return type as MessageType;
};

export class MessageController { //modified
  constructor(private readonly messageService: MessageService) {}

  sendMessage = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified
    const type = getMessageType(req.body.type);

    if (!currentUserId || !chatId || !type) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.sendMessage({
      currentUserId,
      chatId,
      text: getString(req.body.text),
      type,
    });

    return res.status(201).json({
      response,
    });
  };

  listMessages = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.listMessages({
      currentUserId,
      chatId,
      limit: getLimit(req.query.limit),
      cursor: getString(req.query.cursor),
    });

    return res.status(200).json({
      response,
    });
  };

  getMessage = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const messageId = getString(req.params.messageId); //modified

    if (!currentUserId || !messageId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.getMessage({
      currentUserId,
      messageId,
    });

    return res.status(200).json({
      response,
    });
  };

  editMessage = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const messageId = getString(req.params.messageId); //modified
    const text = getString(req.body.text);

    if (!currentUserId || !messageId || !text) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.editMessage({
      currentUserId,
      messageId,
      text,
    });

    return res.status(200).json({
      response,
    });
  };

  deleteMessage = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const messageId = getString(req.params.messageId); //modified

    if (!currentUserId || !messageId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.deleteMessage({
      currentUserId,
      messageId,
    });

    return res.status(200).json({
      response,
    });
  };

  markChatRead = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.markChatRead({
      currentUserId,
      chatId,
      messageId: getString(req.body.messageId),
    });

    return res.status(200).json({
      response,
    });
  };

  searchMessages = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified
    const query = getString(req.query.q);

    if (!currentUserId || !chatId || !query) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.messageService.searchMessages({
      currentUserId,
      chatId,
      query,
      limit: getLimit(req.query.limit),
      cursor: getString(req.query.cursor),
    });

    return res.status(200).json({
      response,
    });
  };

  getUnreadCount = async (req: AuthRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const count = await this.messageService.getUnreadCount({
      currentUserId,
      chatId,
    });

    return res.status(200).json({
      count,
    });
  };

  notImplemented = async (req: AuthRequest, res: Response) => {
    return res.status(501).json({
      message: "This message feature needs additional database models first",
    });
  };
}
