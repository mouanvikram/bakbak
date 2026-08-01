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
  async getMe(dto: MeDto) {}
  async updateMe(dto: UpdateProfileDto) {}
  async updateAvatar(dto: UpdateAvatarDto) {}
  async deleteMe(dto: MeDto) {}

  async searchUsers(dto: SearchUsersDto) {}
  async checkUsername(dto: CheckUsernameDto) {}
  async getProfile(dto: GetUserProfileDto) {}
}
