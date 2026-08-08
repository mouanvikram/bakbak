export type UserProfile = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  bio?: string | null;
};

export type UserSummary = {
  id: string;
  username: string;
  profile?: UserProfile | null;
};

export type MeProfile = {
  id: string;
  email?: string;
  username: string;
  verified?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  displayName?: string | null;
};

export type ChatType = "DIRECT" | "GROUP";
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "FILE"
  | "STICKER"
  | "LOCATION"
  | "CONTACT"
  | "CALL"
  | "SYSTEM";

export type ChatParticipant = {
  id: string;
  userId: string;
  role: "MEMBER" | "ADMIN";
  joinedAt: string;
  lastReadMessageId?: string | null;
  mutedUntil?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  user: UserSummary;
};

export type ChatMessagePreview = {
  id: string;
  type: MessageType;
  text?: string | null;
  senderId: string;
  chatId: string;
  createdAt: string;
  updatedAt: string;
};

export type Chat = {
  id: string;
  type: ChatType;
  directKey?: string | null;
  name?: string | null;
  avatar?: string | null;
  createdById?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: UserSummary | null;
  participants: ChatParticipant[];
  messages: ChatMessagePreview[];
};

export type Message = {
  id: string;
  type: MessageType;
  text?: string | null;
  senderId: string;
  chatId: string;
  deleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sender: UserSummary;
};

export type FriendEntry = {
  friendshipId: string;
  createdAt: string;
  friend: UserSummary;
};

export type FriendRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  sender: UserSummary;
  receiver: UserSummary;
};

export type SearchUser = {
  id: string;
  username: string;
  profile?: UserProfile | null;
};
