import type { ChatService } from "./service";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  createChat = async () => {};
  getChat = async () => {};
  listChats = async () => {};
  updateChat = async () => {};
  deleteChat = async () => {};
  
  addParticipant = async () => {};
  removeParticipant = async () => {};
  
  markAsRead = async () => {};
  findChatById = async () => {};
}
