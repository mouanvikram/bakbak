import { email } from "zod";
import type { UserRepository } from "./repository";
import type {
  CheckUsernameDto,
  GetUserProfileDto,
  MeDto,
  SearchUsersDto,
  UpdateAvatarDto,
  UpdateProfileDto,
} from "./types";

export class UserService {
  constructor(private userRepository: UserRepository) {}

  async getMe(dto: MeDto) {
    const user = await this.userRepository.getProfile({
      where: { id: dto.userId },
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

    if (!user) {
      throw new Error("Invalid credentials");
    }

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

  async updateMe(dto: UpdateProfileDto) {
    const user = await this.userRepository.updateProfile({
      where: {
        id: dto.userId,
      },
      data: {
        profile: {
          update: {
            firstname: dto.firstname,
            lastName: dto.lastname,
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

  async updateAvatar(dto: UpdateAvatarDto) {
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

  async deleteMe(dto: MeDto) {
    await this.userRepository.deleteBy({
      id: dto.userId,
    });

    return {
      message: "Account Deleted Successfully",
    };
  }

  async searchUsers(dto: SearchUsersDto) {}
  async checkUsername(dto: CheckUsernameDto) {}
  async getProfile(dto: GetUserProfileDto) {}
}
