import express from "express";
import { type Request, type Response} from "express";

import dotenv from "dotenv";

const app = express();
dotenv.config();

app.use(express.json());

const PORT = process.env.PORT;

app.get("/",function(req : Request, res: Response){
    res.send("Hello World!");
});

app.listen(PORT,function(){
    console.log("Server is listening on http://localhost:"+PORT);
});
