import express from "express";
import {type Express, type Request, type Response } from "express";
import { signUp, login } from "./auth/auth.controller";


const app:Express = express();
app.use(express.json());

// authorization routes
app.post("/api/signup",signUp);
app.post("/api/login",login);

//


export default app;