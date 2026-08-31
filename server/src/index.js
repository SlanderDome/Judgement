import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socket/handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, "../../client/dist");

// Allowed browser origins for CORS. Defaults to "*" (unchanged production
// behaviour); set CORS_ORIGIN to a comma-separated allowlist to restrict it,
// e.g. CORS_ORIGIN=http://localhost:5173
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((entry) => entry.trim()).filter(Boolean)
  : "*";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use(express.static(clientDistPath));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

registerSocketHandlers(io);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      next();
    }
  });
});

const port = Number(process.env.PORT || 3001);
const host = "0.0.0.0";

httpServer.listen(port, host, () => {
  console.log(`Judgement server listening on ${host}:${port}`);
});

