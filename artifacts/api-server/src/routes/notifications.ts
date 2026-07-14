import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { ListNotificationsQueryParams, MarkNotificationReadParams } from "@workspace/api-zod";

const router = Router();

// GET /notifications
router.get("/notifications", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = ListNotificationsQueryParams.safeParse(req.query);
  const unreadOnly = result.success ? result.data.unreadOnly : false;

  const conditions = [eq(notificationsTable.userId, req.userId!)];
  if (unreadOnly) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  const notifications = await db.query.notificationsTable.findMany({
    where: and(...conditions),
    orderBy: [desc(notificationsTable.createdAt)],
    limit: 50,
  });

  res.status(200).json(notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    emailId: n.emailId ?? null,
    createdAt: n.createdAt.toISOString(),
  })));
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const notification = await db.query.notificationsTable.findFirst({
    where: and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, req.userId!)),
  });

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [updated] = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, params.data.id))
    .returning();

  res.status(200).json({
    id: updated.id,
    type: updated.type,
    title: updated.title,
    message: updated.message,
    isRead: updated.isRead,
    emailId: updated.emailId ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

// POST /notifications/read-all
router.post("/notifications/read-all", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));

  res.status(200).json({ message: "All notifications marked as read" });
});

export default router;
