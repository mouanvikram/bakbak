import express from "express";
import { type Express } from "express";
import authRoutes from "./auth/auth.routes";

const app: Express = express();
app.use(express.json());

app.use("/api/api", authRoutes);

export default app;
