import type { Request, Response } from "express";
import { prisma } from "@sealchat/db";
import { loginSchema, signUpSchema } from "./schemas";
import { comparePassword, hashedPassword } from "../../lib/bcrypt";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export const signUp = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = signUpSchema.parse(req.body);

    const emailExists = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (emailExists) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    const userExists = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (userExists) {
      return res.status(409).json({
        message: "Username already exists",
      });
    }

    const passwordHash = await hashedPassword(password);

    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: passwordHash,
      },
    });

    return res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await comparePassword(password, user?.passwordHash!);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.send("you have logged in succesfully");
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
