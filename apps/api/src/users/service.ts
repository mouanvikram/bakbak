import type { UserRepository } from "./repository";
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
import { AppError, ERROR_CODES, HTTP_STATUS } from "../../errors/app-error";

export class UserService {
	constructor(private userRepository: UserRepository) {}

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
				avatar: user.profile?.avatar,
				displayName: user.profile?.displayName,
				joinedAt: user.createdAt.toISOString(),
				friendsCount,
			},
		};
	}

	async updateMe(
		dto: UpdateProfileRequestType,
	): Promise<UpdateProfileResponseType> {
		const user = await this.userRepository.updateProfile({
			where: {
				id: dto.userId,
			},
			data: {
				profile: {
					update: {
						firstName: dto.firstName,
						lastName: dto.lastName,
						bio: dto.bio,
						displayName: dto.displayName,
					},
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
			avatar: user.profile?.avatar,
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
			avatar: user.profile?.avatar,
		};
	}

	async deleteMe(dto: UserIdType): Promise<DeleteMeResponseType> {
		const user = await this.userRepository.findBy({ id: dto.userId });
		if (!user) {
			throw new AppError(
				HTTP_STATUS.NOT_FOUND,
				ERROR_CODES.USER_NOT_FOUND,
				"User not found",
			);
		}

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

		return {
			users,
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
			avatar: otherUser.profile?.avatar,
			displayName: otherUser.profile?.displayName,
		};
	}
}
