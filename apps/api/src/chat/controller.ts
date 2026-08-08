import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { ChatService } from "./service";

const getString = (value: unknown) => //modified
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getStringArray = (value: unknown) => { //modified
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getLimit = (value: unknown, fallback = 30, max = 100) => { //modified
  const parsed =
    typeof value === "string" ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  createChat = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatType = getString(req.body.type)?.toUpperCase();

    if (!currentUserId) {
      return res.status(400).json({
        message: "Invalid user",
      });
    }

    if (!chatType || !["DIRECT", "GROUP"].includes(chatType)) {
      return res.status(400).json({
        message: "Invalid chat type",
      });
    }

    if (chatType === "DIRECT") {
      const participantId =
        getString(req.body.participantId) ??
        getString(req.body.receiverId) ??
        getString(req.body.userId);

      if (!participantId) {
        return res.status(400).json({
          message: "Participant id is required",
        });
      }

      const response = await this.chatService.createDirectChat({
        currentUserId,
        participantId,
      });

      return res.status(201).json({
        response,
      });
    }

    const name = getString(req.body.name);
    const participantIds =
      getStringArray(req.body.participantIds).length > 0
        ? getStringArray(req.body.participantIds)
        : getStringArray(req.body.memberIds);

    if (!name || participantIds.length === 0) {
      return res.status(400).json({
        message: "Group name and participant ids are required",
      });
    }

    const response = await this.chatService.createGroupChat({
      currentUserId,
      name,
      participantIds,
      avatar: getString(req.body.avatar),
    });

    return res.status(201).json({
      response,
    });
  };

  getChat = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.chatService.getChat({
      currentUserId,
      chatId,
    });

    return res.status(200).json({
      response,
    });
  };

  listChats = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(400).json({
        message: "Invalid user",
      });
    }

    const response = await this.chatService.listChats({
      currentUserId,
      limit: getLimit(req.query.limit),
      cursor: getString(req.query.cursor),
    });

    return res.status(200).json({
      response,
    });
  };

  updateChat = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.chatService.updateChat({
      currentUserId,
      chatId,
      name: getString(req.body.name),
      avatar: req.body.avatar === null ? null : getString(req.body.avatar),
    });

    return res.status(200).json({
      response,
    });
  };

  deleteChat = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified

    if (!currentUserId || !chatId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.chatService.deleteChat({
      currentUserId,
      chatId,
    });

    return res.status(200).json({
      response,
    });
  };

  addParticipant = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified
    const participantId =
      getString(req.body.participantId) ??
      getString(req.body.userId) ??
      getString(req.body.memberId);

    if (!currentUserId || !chatId || !participantId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.chatService.addParticipant({
      currentUserId,
      chatId,
      participantId,
    });

    return res.status(200).json({
      response,
    });
  };

  removeParticipant = async (req: AuthRequest, res: Response) => { //modified
    const currentUserId = req.user?.userId;
    const chatId = getString(req.params.chatId); //modified
    const userId = getString(req.params.userId); //modified

    if (!currentUserId || !chatId || !userId) {
      return res.status(400).json({
        message: "Invalid request",
      });
    }

    const response = await this.chatService.removeParticipant({
      currentUserId,
      chatId,
      participantId: userId,
    });

    return res.status(200).json({
      response,
    });
  };
}
