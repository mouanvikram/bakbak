export interface ChatIdDto {
	currentUserId: string;
	chatId: string;
}

export interface CreateDirectChatDto {
	currentUserId: string;
	participantId: string;
}

export interface CreateGroupChatDto {
	currentUserId: string;
	name: string;
	participantIds: string[];
	avatar?: string | null;
}

export interface ListChatsDto {
	currentUserId: string;
	limit?: number;
	cursor?: string;
}

export interface ParticipantDto {
	currentUserId: string;
	chatId: string;
	participantId: string;
}

export interface UpdateChatDto {
	currentUserId: string;
	chatId: string;
	name?: string;
	avatar?: string | null;
}
