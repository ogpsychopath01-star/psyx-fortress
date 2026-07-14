import { WebSocket } from "ws";

const userSockets = new Map<number, Set<WebSocket>>();

export function registerSocket(userId: number, ws: WebSocket): void {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(ws);
}

export function unregisterSocket(userId: number, ws: WebSocket): void {
  userSockets.get(userId)?.delete(ws);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}

export function pushToUser(userId: number, payload: object): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const msg = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
