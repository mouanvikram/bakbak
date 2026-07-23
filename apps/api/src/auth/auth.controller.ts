import express, { type Request, type Response } from "express";
import { prisma } from "@sealchat/db";
import { signUpSchema } from "./schemas";
import { hashedPassword } from "../../lib/utils";

export const signUp = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = signUpSchema.parse(req.body);

    const userExists = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (userExists) {
      res.send("User Alread Exists");
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
