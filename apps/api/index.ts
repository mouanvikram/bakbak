import express, { type Request, type Response } from "express";
import app from "./src/app";
import { env } from "./lib/config";

app.get("/", (_, res: Response) => {

  return res.status(200).json({
    message: "Path is at '/' ",
  });
});

app.listen(env.PORT, () => {
  console.log(`Server is listening at http://localhost:${env.PORT}`);
});
