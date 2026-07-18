import express, { type Request, type Response } from "express";
import cors from "cors";

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});


app.listen(port,()=>{
    console.log("app is listening on port http://localhost:"+port)
})