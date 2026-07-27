export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginDto {
  identifier: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ResetPasswordType {
  email: string;
  password: string;
}

export interface VerfiyEmailType {
  id: string;
  token: string;
}
