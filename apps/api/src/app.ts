import express from "express";
import {type Express, type Request, type Response } from "express";
import { signUp } from "./auth/auth.controller";


const app:Express = express();
app.use(express.json());


app.post("/api/signup",signUp);


export default app;