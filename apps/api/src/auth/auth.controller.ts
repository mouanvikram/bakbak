import type { Request, Response } from "express";
import { prisma } from "@sealchat/db";
import { loginSchema, signUpSchema } from "./schemas";
import { comparePassword, hashedPassword } from "../../lib/utils";

export interface AuthRequest extends Request{
    user?:{
        userId: String,
    }
}

export const signUp = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = signUpSchema.parse(req.body);

    const emailExists = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (emailExists) {
      res.send("Username already exists");
    }

    const userExists = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (userExists) {
      res.send("User Email Already Exists....");
    }

    const hashPassword = await hashedPassword(password);

    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: hashPassword,
      },
    });

    res.send({
      user,
    });
  } catch (error) {
    console.log(error);
    res.send("Something went wrong while signing up");
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
      res.send("User does not exists. Please Sign Up first");
    }

    const passwordMatch = await comparePassword(password, user?.passwordHash!);

    if (!passwordMatch) {
      res.send("Password didn't not match");
    }

    res.send("you have logged in succesfully");
  } catch (error) {
    console.log(error);
    res.send("Something went wrong while loging in");
  }
};


