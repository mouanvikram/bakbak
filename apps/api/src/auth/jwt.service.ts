import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  username: string;
}
export class JwtService {
  constructor(private readonly secret: string) {}
  signJwt<T extends object>(payload: T, options?: SignOptions): string {
    return jwt.sign(payload, this.secret, options);
  }
  verifyJwt<T extends JwtPayload>(token: string): T {
    return jwt.verify(token, this.secret) as T;
  }

  decodeJwt<T extends JwtPayload>(token: string): T | null {
    return jwt.decode(token) as T;
  }
}

