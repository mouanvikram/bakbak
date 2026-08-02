import type { ChatRepository } from "./repository";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}
  createChat = async () => {};
  findChatById = async () => {};
  listChats = async () => {};
  updateChat = async () => {};
  deleteChat = async () => {};

  addParticipant = async () => {};
  removeParticipant = async () => {};

  markAsRead = async () => {};
}
