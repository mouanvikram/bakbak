import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  username: string;
  typ: "access";
  sid?: string;
}

export class JwtService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    secret: string,
    options?: { issuer?: string; audience?: string },
  ) {
    this.secret = secret;
    this.issuer = options?.issuer ?? "bakbak-api";
    this.audience = options?.audience ?? "bakbak-web";
  }

  signJwt<T extends object>(payload: T, options?: SignOptions): string {
    return jwt.sign(payload, this.secret, {
      ...options,
      algorithm: "HS256",
      issuer: this.issuer,
      audience: this.audience,
      jwtid: randomUUID(),
      noTimestamp: false,
    });
  }

  verifyJwt<T extends JwtPayload>(token: string): T {
    return jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
      issuer: this.issuer,
      audience: this.audience,
      // Allow 30 s of clock skew between sign and verify.
      clockTolerance: 30,
    }) as T;
  }
}
