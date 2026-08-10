import { createServer } from "node:http";
import { Server } from "socket.io";

import app from "./app";
import { initializeWebSocket } from "./websocket";

const PORT = Number(process.env.PORT) || 3000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        credentials: true,
    },
});

initializeWebSocket(io);

httpServer.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});