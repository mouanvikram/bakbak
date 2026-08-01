export interface AuthenticatedDto {
  userId: string;
}

export interface MeDto extends AuthenticatedDto {}

export interface UpdateProfileDto extends AuthenticatedDto {
  displayName?: string;
  bio?: string;
  firstname?: string;
  lastname?: string;
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

export interface GetProfileDto {
  username: string;
}
