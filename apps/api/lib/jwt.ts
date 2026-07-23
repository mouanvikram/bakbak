import jwt from "jsonwebtoken";
import { env } from "./config";

export const signJWT = async (userId: string) => {
  return jwt.sign({ userId }, env.JWT_SECRET!, { expiresIn: "1h" });
};

export const verifyJWT = async (token: string) => {
  return jwt.verify(token, env.JWT_SECRET!);
};
