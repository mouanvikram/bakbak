export interface RegisterDto {
  firstname?: string;
  lastname?: string;
  avatarUrl?: string;
  bio?: string;
  displayName?: string;
  username: string;
  email: string;
  password: string;
}
export interface SendVerificationEmailDto{
  email: string,
  username?: string,
  url: string,
}
export interface LoginDto {
  identifier: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ChangePasswordDto {
  email: string;
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordType {
  email: string;
  password: string;
}

export interface VerfiyEmailType {
  token: string
}
