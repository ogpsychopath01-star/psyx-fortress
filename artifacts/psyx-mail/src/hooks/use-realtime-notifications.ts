import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getListEmailsQueryKey,
  getGetEmailStatsQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return BASE_URL
    ? `${proto}//${host}${BASE_URL}/api/ws`
    : `${proto}//${host}/api/ws`;
}

/** Request and cache browser notification permission */
async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/** Show a native browser notification; clicking navigates to emailId if provided */
function showBrowserNotification(
  title: string,
  body: string,
  emailId?: number,
) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: `psyx-mail-${emailId ?? "alert"}`,
    });
    setTimeout(() => n.close(), 8_000);
    n.onclick = () => {
      window.focus();
      if (emailId) {
        window.location.href = `${window.location.origin}${BASE_URL}/dashboard/email/${emailId}`;
      }
      n.close();
    };
  } catch {
    // Silently ignored — some browsers block notifications
  }
}

export function useRealtimeNotifications(userId?: number) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const unmounted = useRef(false);

  /** Exposed so layout can inject the router's navigate function */
  const navigateRef = useRef<((path: string) => void) | null>(null);

  // Ask for notification permission as soon as user is known
  useEffect(() => {
    if (userId) requestNotificationPermission();
  }, [userId]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey({ folder: "inbox" }) });
    queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({ unreadOnly: true }) });
  }, [queryClient]);

  const connect = useCallback(() => {
    if (!userId || unmounted.current) return;

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0; // reset backoff on success
      const token = localStorage.getItem("psyx_token");
      ws.send(JSON.stringify({ type: "auth", userId, token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        // ── Keep-alive: server sends { type:"ping" }, we reply pong ──
        if (msg.type === "ping" || msg.type === "auth_ok") return;

        // ── New email in inbox ─────────────────────────────────────────
        if (msg.type === "new_mail") {
          const subject = msg.subject || "New message";
          const from = msg.fromEmail || msg.from || "Unknown sender";
          const emailId: number | undefined = msg.emailId;

          toast.info(`📬 ${subject}`, {
            description: `From: ${from}`,
            duration: 6_000,
            action: emailId
              ? {
                  label: "Open →",
                  onClick: () => {
                    if (navigateRef.current) {
                      navigateRef.current(`/dashboard/email/${emailId}`);
                    } else {
                      window.location.href = `${window.location.origin}${BASE_URL}/dashboard/email/${emailId}`;
                    }
                  },
                }
              : undefined,
          });

          showBrowserNotification(`📬 New mail — PSYX`, `${subject} · from ${from}`, emailId);
          invalidateAll();
        }

        // ── System announcements / general notifications ───────────────
        if (msg.type === "announcement" || msg.type === "notification") {
          const title = msg.title || "System Alert";
          const message = msg.message || "";
          toast.message(`📡 ${title}`, { description: message, duration: 8_000 });
          showBrowserNotification(`PSYX FORTRESS: ${title}`, message);
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({ unreadOnly: true }) });
        }
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      // Exponential back-off: 3s, 6s, 12s … capped at 30s
      const delay = Math.min(3_000 * 2 ** retryCount.current, 30_000);
      retryCount.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [userId, queryClient, invalidateAll]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { navigateRef };
}
