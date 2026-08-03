import type { Response } from "express";
import type { AuthRequest } from "../auth/controller";
import type { ChatService } from "./service";

export class ChatController {
  constructor(private readonly chatService: ChatService) { }
  createChat = async (req: AuthRequest, res: Response) => {
    // const response = await this.chatService.createChat();

    return res.status(200).json({
      // message: response,
    });
  };
  getChat = async (req: AuthRequest, res: Response) => {
    // const response = await this.chatService.
  };
  listChats = async (req: AuthRequest, res: Response) => {
    // const response = await this.chatService.listChats();

    return res.status(200).json({
      // response,
    });
  };
  updateChat = async (req: AuthRequest, res: Response) => {
    // const response = await this.chatService.updateChat();

    return res.status(200).json({
      // response,
    });
  };
  deleteChat = async (req: AuthRequest, res: Response) => {
    const response = await this.chatService.deleteChat();

    return res.status(200).json({
      response,
    });
  };

  addParticipant = async (req: AuthRequest, res: Response) => {
    const response = await this.chatService.addParticipant();

    return res.status(200).json({
      response,
    });
  };
  removeParticipant = async (req: AuthRequest, res: Response) => {
    const response = await this.chatService.removeParticipant();

    return res.status(200).json({
      response,
    });
  };

}
