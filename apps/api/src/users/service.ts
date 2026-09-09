import crypto from "node:crypto";
import { Prisma } from "@bakbak/db";
import type { UserRepository } from "./repository";
import type { FriendRepository } from "@/friends/repository";
import type { RefreshTokenRepository } from "@/auth/refresh-token.repository";
import { disconnectSockets } from "@/websocket/emitter";
import type { StorageProvider } from "@/uploads/storage.provider";
import type {
  CheckUsernameRequestType,
  CheckUsernameResponseType,
  DeleteMeResponseType,
  FriendshipStatusType,
  GetMeResponseType,
  GetProfileRequestType,
  GetProfileResponseType,
  SearchUsersRequestType,
  SearchUsersResponseType,
  UpdateAvatarRequestType,
  UpdateAvatarResponseType,
  UpdateProfileRequestType,
  UpdateProfileResponseType,
  UserIdType,
} from "@bakbak/contracts";
import type { UploadFile } from "@bakbak/contracts";
import { BIO_MIN_LENGTH } from "@bakbak/contracts";
import { AppError, ERROR_CODES, HTTP_STATUS } from "@/errors/app-error";
import { resolveAvatarUrl } from "@/uploads/avatar-url";
import { uploadsConfig } from "@/uploads/config";
import { titleCaseName } from "@/lib/name-case";

/**
 * Present a stored bio to clients as the contract expects: `null`, or a real
 * string of at least {@link BIO_MIN_LENGTH} chars. Guards against legacy rows
 * that hold `""` or a too-short value from before the bio rules tightened.
 */
function readBio(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= BIO_MIN_LENGTH ? trimmed : null;
}

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private readonly storageProvider: StorageProvider,
    private readonly friendRepository: FriendRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async getMe(dto: UserIdType): Promise<GetMeResponseType> {
    const user = await this.userRepository.getProfile({
      where: { id: dto.userId },
      select: {
        id: true,
        email: true,
        username: true,
        isEmailVerified: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            bio: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        "Authentication required",
      );
    }

    const friendsCount = await this.userRepository.countFriends(user.id);

    return {
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        verified: user.isEmailVerified,
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        bio: readBio(user.profile?.bio),
        avatar: await resolveAvatarUrl(
          user.profile?.avatar,
          this.storageProvider,
        ),
        displayName: user.profile?.displayName,
        joinedAt: user.createdAt.toISOString(),
        friendsCount,
      },
    };
  }

  async updateMe(
    dto: UpdateProfileRequestType,
  ): Promise<UpdateProfileResponseType> {
    const data:
      Prisma.UserProfileUpdateInput | Prisma.UserProfileUncheckedUpdateInput =
      {};

    if (dto.firstName !== undefined)
      data.firstName = titleCaseName(dto.firstName);
    if (dto.lastName !== undefined) data.lastName = titleCaseName(dto.lastName);
    if (dto.displayName !== undefined) {
      data.displayName = titleCaseName(dto.displayName);
    }
    if (dto.bio !== undefined) data.bio = dto.bio;

    const userData: Prisma.UserUpdateInput = {};
    if (dto.username !== undefined) {
      const username = dto.username.trim();
      const current = await this.userRepository.findBy({ id: dto.userId });
      if (!current) {
        throw new AppError(
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.USER_NOT_FOUND,
          "User does not exist",
        );
      }
      // Only touch it when it actually changes — otherwise the caller's
      // own username would read as "taken".
      if (username !== current.username) {
        const taken = await this.userRepository.findBy({ username });
        if (taken) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.USERNAME_ALREADY_EXISTS,
            "That username is already taken",
          );
        }
        userData.username = username;
      }
    }

    const user = await this.userRepository
      .updateProfile({
        where: { id: dto.userId },
        data: {
          ...userData,
          profile: { update: data },
        },
        include: { profile: true },
      })
      .catch((error: unknown) => {
        // Lost a race for the same username between the check and write.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.USERNAME_ALREADY_EXISTS,
            "That username is already taken",
          );
        }
        throw error;
      });

    return {
      username: user.username,
      verified: user.isEmailVerified,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      bio: readBio(user.profile?.bio),
      avatar: await resolveAvatarUrl(
        user.profile?.avatar,
        this.storageProvider,
      ),
      displayName: user.profile?.displayName,
    };
  }

  async updateAvatar(
    dto: UpdateAvatarRequestType,
  ): Promise<UpdateAvatarResponseType> {
    const user = await this.userRepository.updateProfile({
      where: {
        id: dto.userId,
      },
      data: {
        profile: {
          update: {
            avatar: dto.avatar,
          },
        },
      },
      select: {
        profile: {
          select: {
            avatar: true,
          },
        },
      },
    });

    return {
      avatar: await resolveAvatarUrl(
        user.profile?.avatar,
        this.storageProvider,
      ),
    };
  }

  async uploadAvatar(
    dto: UserIdType & { file: UploadFile },
  ): Promise<UpdateAvatarResponseType> {
    const current = await this.userRepository.getProfile({
      where: { id: dto.userId },
      select: {
        id: true,
        profile: { select: { avatar: true } },
      },
    });
    if (!current) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    const previousKey =
      current.profile?.avatar && !/^https?:\/\//.test(current.profile.avatar)
        ? current.profile.avatar
        : null;

    const extMatch = dto.file.originalname.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch?.[1]?.toLowerCase() ?? "";
    const key = `avatars/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

    await this.storageProvider.upload(key, dto.file.buffer, dto.file.mimetype);

    await this.userRepository.updateProfile({
      where: { id: dto.userId },
      data: {
        profile: {
          update: { avatar: key },
        },
      },
    });

    // Best-effort removal of the previous avatar object.
    if (previousKey) {
      await this.storageProvider.delete(previousKey).catch(() => {});
    }

    return {
      avatar: await this.storageProvider.getSignedUrl(
        key,
        uploadsConfig.avatarUrlTtlSeconds,
      ),
    };
  }

  async deleteMe(dto: UserIdType): Promise<DeleteMeResponseType> {
    const user = await this.userRepository.getProfile({
      where: { id: dto.userId },
      select: { id: true, isEmailVerified: true },
    });
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    // An unverified account owns no space (no one can find or message it),
    // so its owner must prove the email before destruction — a stray signup
    // shouldn't be able to delete a real account created with their address.
    if (!user.isEmailVerified) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "Email is not verified",
      );
    }

    // Soft delete only: nothing is removed, and messages they sent are left

    await this.userRepository.markDeleted(dto.userId);

    // A deleted account must not keep calling the API: revoke every
    // session (and its refresh tokens)

    await this.refreshTokenRepository.revokeAllSessionsForUser(dto.userId);
    await disconnectSockets({ userId: dto.userId });

    return {
      message: "Account Deleted Successfully",
    };
  }

  async searchUsers(
    dto: SearchUsersRequestType,
  ): Promise<SearchUsersResponseType> {
    const query = dto.query;
    const users = await this.userRepository.getUsers(query);

    const resolved = await Promise.all(
      users.map(async (user) => ({
        ...user,
        profile: user.profile
          ? {
              ...user.profile,
              bio: readBio(user.profile.bio),
              avatar: await resolveAvatarUrl(
                user.profile.avatar,
                this.storageProvider,
              ),
            }
          : user.profile,
      })),
    );

    return {
      users: resolved,
    };
  }

  async checkUsername(
    dto: CheckUsernameRequestType,
  ): Promise<CheckUsernameResponseType> {
    const available = await this.userRepository.findBy({
      username: dto.username,
    });

    if (available) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.CONFLICT,
        "Username is not available",
      );
    }

    return {
      available: true,
    };
  }

  async getProfile(
    dto: GetProfileRequestType & { currentUserId: string },
  ): Promise<GetProfileResponseType> {
    const otherUser = await this.userRepository.getProfile({
      where: { username: dto.username },
      select: {
        id: true,
        username: true,
        isEmailVerified: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            bio: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    if (!otherUser) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    const isSelf = otherUser.id === dto.currentUserId;
    const friendsCount = await this.userRepository.countFriends(otherUser.id);

    let friendshipStatus: FriendshipStatusType = isSelf ? "self" : "none";
    let pendingRequestId: string | null = null;

    if (!isSelf) {
      const friendship = await this.friendRepository.findFriendship({
        OR: [
          { user1Id: dto.currentUserId, user2Id: otherUser.id },
          { user1Id: otherUser.id, user2Id: dto.currentUserId },
        ],
      });

      if (friendship) {
        friendshipStatus = "friends";
      } else {
        const request = await this.friendRepository.findLatestRequestBetween(
          dto.currentUserId,
          otherUser.id,
        );
        if (request?.status === "PENDING") {
          friendshipStatus =
            request.senderId === dto.currentUserId
              ? "request_sent"
              : "request_received";
          pendingRequestId = request.id;
        }
      }
    }

    return {
      id: otherUser.id,
      username: otherUser.username,
      verified: otherUser.isEmailVerified,
      firstName: otherUser.profile?.firstName,
      lastName: otherUser.profile?.lastName,
      bio: readBio(otherUser.profile?.bio),
      avatar: await resolveAvatarUrl(
        otherUser.profile?.avatar,
        this.storageProvider,
      ),
      displayName: otherUser.profile?.displayName,
      joinedAt: otherUser.createdAt.toISOString(),
      friendsCount,
      friendshipStatus,
      pendingRequestId,
    };
  }
}
