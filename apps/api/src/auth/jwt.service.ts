import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  username: string;
  // Discriminates a real access token from other JWTs signed with the same
  // secret (e.g. the 2FA login challenge) — required so one can't be replayed
  // as the other. See auth.middleware.ts / websocket/auth.ts.
  typ: "access";
  // Stable login-session id; absent on tokens minted before session tracking.
  sid?: string;
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
