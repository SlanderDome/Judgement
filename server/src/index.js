import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socket/handlers.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

registerSocketHandlers(io);

const port = Number(process.env.PORT || 3001);

httpServer.listen(port, () => {
  console.log(`Judgement server listening on http://localhost:${port}`);
});
