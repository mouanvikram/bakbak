export interface CreateDirectChatDto { //modified
  currentUserId: string;
  participantId: string;
}

export interface CreateGroupChatDto { //modified
  currentUserId: string;
  name: string;
  participantIds: string[];
  avatar?: string;
}

export interface ListChatsDto { //modified
  currentUserId: string;
  limit?: number;
  cursor?: string;
}

export interface ChatIdDto { //modified
  currentUserId: string;
  chatId: string;
}

export interface UpdateChatDto extends ChatIdDto { //modified
  name?: string;
  avatar?: string | null;
}

export interface ParticipantDto extends ChatIdDto { //modified
  participantId: string;
}
