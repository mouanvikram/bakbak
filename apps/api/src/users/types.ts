export interface AuthenticatedDto {
  userId: string;
}

export interface MeDto extends AuthenticatedDto {}

export interface UpdateProfileDto extends AuthenticatedDto {
  displayName?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
}
export interface UpdateAvatarDto extends AuthenticatedDto {
  avatar?: string;
}
export interface CheckUsernameDto {
  username: string;
}
export interface SearchUsersDto {
  query: string;
}

export interface GetUserProfileDto {
  username: string;
}
