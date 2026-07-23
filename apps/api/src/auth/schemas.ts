import z from "zod";

export const signUpSchema = z.object({
    username: z.string().nonempty(),
    email: z.email(),
    password: z.string().min(8).max(18),
    isEmailVerified: z.boolean().default(false),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8).max(18),
});