import jwt from "jsonwebtoken";
import { env } from "./config";

export const signToken = async (userId: string) => {
  return jwt.sign({ userId }, env.JWT_SECRET!, { expiresIn: "1h" });
};

export const verifyToken = async (token: string) => {
  return jwt.verify(token, env.JWT_SECRET!);
};
