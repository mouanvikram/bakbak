import { authConfig } from "./config";

export class PasswordService {
  async hash(password: string) {
    return Bun.password.hash(password, {
      algorithm: authConfig.passwordHashing.algorithm,
      timeCost: authConfig.passwordHashing.timeCost,
      memoryCost: authConfig.passwordHashing.memoryCost,
    });
  }

  async verify(password: string, hash: string) {
    return Bun.password.verify(password, hash);
  }
}
