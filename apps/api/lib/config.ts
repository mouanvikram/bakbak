import dotenv from "dotenv";
dotenv.config();

export const env = {
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET,
}

