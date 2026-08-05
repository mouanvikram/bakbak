import type { ChatRepository } from "./repository";
import type { CreateDirectChatDto } from "./types";

export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}
  createDirectChat = async (
    dto: CreateDirectChatDto
  ) => {
    
  };
  createGroupChat = async () => {};
  renameChat = async () => {};
  addParticipant = async () => {};
  removeParticipant = async () => {};
  leaveChat = async () => {};
  deleteChat = async () => {};
}
