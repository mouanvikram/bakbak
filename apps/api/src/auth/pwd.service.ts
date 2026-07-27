export class PasswordService {
  async hash(password: string) {
    return Bun.password.hash(password, {
      algorithm: "argon2id",
      timeCost: 3,
      memoryCost: 65536,
    });
  }

  async verify(password: string, hash: string) {
    return Bun.password.verify(password, hash);
  }
}
