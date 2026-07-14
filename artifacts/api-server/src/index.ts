import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { registerSocket, unregisterSocket } from "./lib/ws-manager";
import { startSmtpInbound } from "./lib/smtp-inbound";
import { verifyToken } from "./middlewares/auth";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const server = http.createServer(app);

// ─── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: "/api/ws" });

wss.on("connection", (ws) => {
  let userId: number | null = null;
  let authenticated = false;

  // Kick unauthenticated connections after 10 seconds
  const authTimeout = setTimeout(() => {
    if (!authenticated) ws.close(1008, "Authentication timeout");
  }, 10_000);

  // ── Keepalive: ping every 30 s, terminate if no pong within 10 s ──────────
  let isAlive = true;
  const keepalive = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      return;
    }
    isAlive = false;
    ws.ping();
  }, 30_000);

  ws.on("pong", () => { isAlive = true; });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Handle JSON-level pong from browsers that can't send native pong
      if (msg.type === "pong") { isAlive = true; return; }

      if (msg.type === "auth" && typeof msg.userId === "number") {
        const token = msg.token as string | undefined;

        if (token) {
          const payload = verifyToken(token);
          if (payload && payload.userId === msg.userId) {
            authenticated = true;
            clearTimeout(authTimeout);
            userId = msg.userId;
            registerSocket(userId, ws);
            ws.send(JSON.stringify({ type: "auth_ok" }));
            return;
          }
        }

        // Dev fallback — userId-only auth
        if (process.env.NODE_ENV !== "production") {
          authenticated = true;
          clearTimeout(authTimeout);
          userId = msg.userId as number;
          registerSocket(userId, ws);
          ws.send(JSON.stringify({ type: "auth_ok" }));
          logger.warn({ userId }, "WS auth without token — only allowed in dev");
        } else {
          ws.close(1008, "Invalid credentials");
        }
      }
    } catch { /* ignore malformed messages */ }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    clearInterval(keepalive);
    if (userId !== null) unregisterSocket(userId, ws);
  });

  ws.on("error", () => ws.close());

  // Initial ping so client knows we're alive
  ws.send(JSON.stringify({ type: "ping" }));
});

// ─── HTTP server ──────────────────────────────────────────────────────────────
server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// ─── SMTP inbound (port 2525) ─────────────────────────────────────────────────
const SMTP_PORT = Number(process.env.SMTP_INBOUND_PORT ?? 2525);
try {
  startSmtpInbound(SMTP_PORT);
} catch (err) {
  logger.warn({ err }, "Could not start SMTP inbound — inbound email from external services disabled");
}
