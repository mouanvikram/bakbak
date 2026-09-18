import crypto from "node:crypto";
import { Prisma } from "@bakbak/db";
import type { UserRepository } from "./repository";
import type { FriendRepository } from "@/friends/repository";
import type { PasswordService } from "@/auth/password.service";
import type { RefreshTokenRepository } from "@/auth/refresh-token.repository";
import type { AuthService } from "@/auth/service";
import type { EmailService } from "@/email/service";
import { authConfig } from "@/auth/config";
import { disconnectSockets } from "@/websocket/emitter";
import logger from "@/lib/logger";
import type { StorageProvider } from "@/uploads/storage.provider";
import type {
  CheckUsernameRequestType,
  CheckUsernameResponseType,
  DeleteMeChallengeRequestType,
  DeleteMeChallengeResponseType,
  DeleteMeRequestType,
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
import { invalidateFriendsOf } from "@/friends/cache";
import { titleCaseName } from "@/lib/name-case";
import { usersConfig } from "./config";

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
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly passwordService: PasswordService,
  ) {}

  async getMe(dto: UserIdType): Promise<GetMeResponseType> {
    const user = await this.userRepository.findMeById(dto.userId);

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
    const data: {
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      bio?: string | null;
    } = {};

    if (dto.firstName !== undefined)
      data.firstName = titleCaseName(dto.firstName);
    if (dto.lastName !== undefined) data.lastName = titleCaseName(dto.lastName);
    if (dto.displayName !== undefined) {
      data.displayName = titleCaseName(dto.displayName);
    }
    if (dto.bio !== undefined) data.bio = dto.bio;

    const userData: { username?: string; usernameChangedAt?: Date } = {};
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
        if (
          current.usernameChangedAt &&
          Date.now() - current.usernameChangedAt.getTime() <
            usersConfig.usernameChangeCooldownMs
        ) {
          const daysLeft = Math.ceil(
            (current.usernameChangedAt.getTime() +
              usersConfig.usernameChangeCooldownMs -
              Date.now()) /
              86_400_000,
          );
          throw new AppError(
            HTTP_STATUS.TOO_MANY_REQUESTS,
            ERROR_CODES.USERNAME_CHANGE_COOLDOWN,
            `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          );
        }
        const taken = await this.userRepository.findBy({ username });
        if (taken) {
          throw new AppError(
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.USERNAME_ALREADY_EXISTS,
            "That username is already taken",
          );
        }
        userData.username = username;
        userData.usernameChangedAt = new Date();
      }
    }

    const user = await this.userRepository
      .updateAccount(dto.userId, userData, data)
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

    // Friends' cached lists show this name, username and bio.
    await invalidateFriendsOf(dto.userId);

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
    const user = await this.userRepository.setAvatar(dto.userId, dto.avatar);

    await invalidateFriendsOf(dto.userId);

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
    const current = await this.userRepository.findAvatarKey(dto.userId);
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

    await this.userRepository.setAvatar(dto.userId, key);
    await invalidateFriendsOf(dto.userId);

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

  /**
   * Fetch a live, verified account row carrying the fields needed to re-prove
   * the owner (password hash + 2FA state). Deletion is destructive, so both
   * the challenge step and the delete itself re-check these.
   */
  private async findVerifiedOwner(userId: string) {
    const user = await this.userRepository.findOwnerForReauth(userId);
    if (!user) {
      throw new AppError(
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    // An unverified account owns no space (no one can find or message it),
    // so its owner must prove the email before any destructive step — a
    // stray signup shouldn't be able to delete a real account created with
    // their address.
    if (!user.isEmailVerified) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "Email is not verified",
      );
    }

    return user;
  }

  private async provePassword(
    password: string,
    passwordHash: string,
  ): Promise<void> {
    const matches = await this.passwordService.verify(password, passwordHash);
    if (!matches) {
      throw new AppError(
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.INVALID_CREDENTIALS,
        "Credentials do not match",
      );
    }
  }

  /**
   * Step 1 of deleting the account: proves the password (so a code is only
   * ever emailed to the owner) and, when 2FA is on, emails a fresh code the
   * delete step will demand. Called by `POST /users/me/delete-challenge`.
   */
  async requestDeletionChallenge(
    dto: DeleteMeChallengeRequestType,
  ): Promise<DeleteMeChallengeResponseType> {
    const user = await this.findVerifiedOwner(dto.userId);
    await this.provePassword(dto.password, user.passwordHash);

    const twoFactorEnabled = user.settings?.twoFactorEnabled ?? false;
    if (twoFactorEnabled) {
      // Single-use, hashed, 10-minute TTL; a repeat request replaces it.
      await this.authService.sendTwoFactorCode(
        user.id,
        user.username,
        user.email,
      );
    }

    return {
      twoFactorRequired: twoFactorEnabled,
      message: twoFactorEnabled
        ? "Check your inbox for a verification code."
        : "Password confirmed.",
    };
  }

  async deleteMe(dto: DeleteMeRequestType): Promise<DeleteMeResponseType> {
    const user = await this.findVerifiedOwner(dto.userId);
    await this.provePassword(dto.password, user.passwordHash);

    // The account has 2FA on: a holder of the session alone must not be able
    // to destroy it — the freshly-emailed (single-use) code is required too.
    if (user.settings?.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.TWO_FACTOR_CODE_REQUIRED,
          "Two-factor code required",
        );
      }
      await this.authService.consumeTwoFactorCode(user.id, dto.twoFactorCode);
    }

    // Soft delete only: nothing is removed, and messages they sent are left

    await this.userRepository.markDeleted(dto.userId);
    // Friends lists hide deleted accounts; drop the copies that still show it.
    await invalidateFriendsOf(dto.userId);

    // Tell the owner the account is scheduled for permanent deletion, and
    // send the recovery link they can use to undo it within the window.
    try {
      await this.emailService.sendAccountDeletionEmail({
        email: user.email,
        username: user.username,
        deletionTime: new Date(
          Date.now() + authConfig.accountRecoveryWindowMs,
        ).toLocaleString(),
      });
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        "Failed to send account deletion email",
      );
    }

    // A recovery token is minted *after* the mark so the link is only usable
    // while the account is actually deleted (this is the one auth email that
    // targets a soft-deleted row).
    await this.authService.requestAccountRecovery(dto.userId);

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
    const otherUser = await this.userRepository.findPublicProfileByUsername(
      dto.username,
    );

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
      const friendship = await this.friendRepository.findFriendshipBetween(
        dto.currentUserId,
        otherUser.id,
      );

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
