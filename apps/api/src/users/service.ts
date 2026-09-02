import crypto from "node:crypto";
import { Prisma } from "@bakbak/db";
import type { UserRepository } from "./repository";
import type { StorageProvider } from "../uploads/storage.provider";
import type {
	CheckUsernameRequestType,
	CheckUsernameResponseType,
	DeleteMeResponseType,
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
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";
import { resolveAvatarUrl, AVATAR_URL_TTL_SECONDS } from "../uploads/avatar-url";
import { titleCaseName } from "../helpers/name-case";

export class UserService {
	constructor(
		private userRepository: UserRepository,
		private readonly storageProvider: StorageProvider,
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
				bio: user.profile?.bio,
				avatar: await resolveAvatarUrl(user.profile?.avatar, this.storageProvider),
				displayName: user.profile?.displayName,
				joinedAt: user.createdAt.toISOString(),
				friendsCount,
			},
		};
	}

	async updateMe(
		dto: UpdateProfileRequestType,
	): Promise<UpdateProfileResponseType> {
		const data: Prisma.UserProfileUpdateInput | Prisma.UserProfileUncheckedUpdateInput = {};

		if (dto.firstName !== undefined) data.firstName = titleCaseName(dto.firstName);
		if (dto.lastName !== undefined) data.lastName = titleCaseName(dto.lastName);
		if (dto.displayName !== undefined) {
			data.displayName = titleCaseName(dto.displayName);
		}
		if (dto.bio !== undefined) data.bio = dto.bio;

		const user = await this.userRepository.updateProfile({
			where: {
				id: dto.userId,
			},
			data: {
				profile: {
					update: data,
				},
			},
			include: {
				profile: true,
			},
		});

		return {
			username: user.username,
			verified: user.isEmailVerified,
			firstName: user.profile?.firstName,
			lastName: user.profile?.lastName,
			bio: user.profile?.bio,
			avatar: await resolveAvatarUrl(user.profile?.avatar, this.storageProvider),
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
			avatar: await resolveAvatarUrl(user.profile?.avatar, this.storageProvider),
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
				AVATAR_URL_TTL_SECONDS,
			),
		};
	}

	async deleteMe(dto: UserIdType): Promise<DeleteMeResponseType> {
		const user = await this.userRepository.getProfile({
			where: { id: dto.userId },
			select: {
				id: true,
				profile: {
					select: { avatar: true },
				},
			},
		});
		if (!user) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.USER_NOT_FOUND,
				"User not found",
			);
		}

		const avatarKey =
			user.profile?.avatar && !/^https?:\/\//.test(user.profile.avatar)
				? user.profile.avatar
				: null;
		const filePaths = await this.userRepository.getSentMessageFilePaths(
			dto.userId,
		);

		// Message.sender is onDelete: NoAction, so remove the user's messages
		// (and their attachments) before the user row can be deleted.
		await this.userRepository.deleteSentMessages(dto.userId);

		// Remove stored objects, then the user (cascades to profile, settings,
		// tokens, friend requests, friendships and chat memberships). Each
		// removal is best-effort so a missing object can't block deletion.
		await Promise.all(
			[...filePaths, ...(avatarKey ? [avatarKey] : [])].map((key) =>
				this.storageProvider.delete(key).catch(() => {}),
			),
		);

		await this.userRepository.deleteBy({
			id: dto.userId,
		});

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
		dto: GetProfileRequestType,
	): Promise<GetProfileResponseType> {
		const otherUser = await this.userRepository.getProfile({
			where: { username: dto.username },
			select: {
				username: true,
				isEmailVerified: true,
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

		return {
			username: otherUser.username,
			verified: otherUser.isEmailVerified,
			firstName: otherUser.profile?.firstName,
			lastName: otherUser.profile?.lastName,
			bio: otherUser.profile?.bio,
			avatar: await resolveAvatarUrl(otherUser.profile?.avatar, this.storageProvider),
			displayName: otherUser.profile?.displayName,
		};
	}
}
