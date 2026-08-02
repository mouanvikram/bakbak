import type { ChatRepository } from "./repository";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}
  createDirectChat = async () => {};
  createGroupChat = async () => {};
  renameChat = async () => {};
  addParticipant = async () => {};
  removeParticipant = async () => {};
  leaveChat = async () => {};
  deleteChat = async () => {};
}
