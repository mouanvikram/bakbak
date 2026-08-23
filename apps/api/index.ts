import { createServer } from "node:http";
import { Server } from "socket.io";
import express, { type Request, type Response } from "express";
import app from "./src/app";
import { env } from "./lib/config";
import { initializeWebSocket } from "./src/websocket";

app.get("/", (_: Request, res: Response) => {
  return res.status(200).json({
    message: "Path is at '/' ",
  });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    credentials: true,
  },
});

initializeWebSocket(io);

httpServer.listen(env.PORT, () => {
  console.log(`Server is listening at http://localhost:${env.PORT}`);
});
