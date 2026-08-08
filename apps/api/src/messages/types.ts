import type { MessageType } from "@sealchat/db"; //modified

export interface ChatMessagesDto { //modified
  currentUserId: string;
  chatId: string;
  limit?: number;
  cursor?: string;
}

export interface SendMessageDto extends ChatMessagesDto { //modified
  text?: string;
  type: MessageType;
}

export interface MessageIdDto { //modified
  currentUserId: string;
  messageId: string;
}

export interface EditMessageDto extends MessageIdDto { //modified
  text: string;
}

export interface MarkChatReadDto extends ChatMessagesDto { //modified
  messageId?: string;
}

export interface SearchMessagesDto extends ChatMessagesDto { //modified
  query: string;
}
