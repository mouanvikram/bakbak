import z from "zod";

export const signUpSchema = z.object({
    username: z.string(),
    email: z.email(),
    password: z.string(),
    isEmailVerified: z.boolean(),
})