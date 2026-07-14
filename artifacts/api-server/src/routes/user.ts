import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, activityLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { UpdateUserProfileBody, ChangePasswordBody } from "@workspace/api-zod";

const router = Router();

// GET /user/profile
router.get("/user/profile", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    recoveryEmail: user.recoveryEmail,
    theme: user.theme,
    language: user.language,
    notificationsEnabled: user.notificationsEnabled,
    twoFactorEnabled: user.twoFactorEnabled,
    storageUsed: user.storageUsed,
    storageLimit: user.storageLimit,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  });
});

// PATCH /user/profile
router.patch("/user/profile", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = UpdateUserProfileBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  const data = result.data;

  if (data.displayName !== undefined) updates.displayName = data.displayName;
  if (data.recoveryEmail !== undefined) updates.recoveryEmail = data.recoveryEmail;
  if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
  if (data.theme !== undefined) updates.theme = data.theme;
  if (data.language !== undefined) updates.language = data.language;
  if (data.notificationsEnabled !== undefined) updates.notificationsEnabled = data.notificationsEnabled;
  updates.updatedAt = new Date();

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.status(200).json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    displayName: updated.displayName,
    role: updated.role,
    status: updated.status,
    avatarUrl: updated.avatarUrl,
    recoveryEmail: updated.recoveryEmail,
    theme: updated.theme,
    language: updated.language,
    notificationsEnabled: updated.notificationsEnabled,
    twoFactorEnabled: updated.twoFactorEnabled,
    storageUsed: updated.storageUsed,
    storageLimit: updated.storageLimit,
    createdAt: updated.createdAt.toISOString(),
    lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
  });
});

// POST /user/change-password
router.post("/user/change-password", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = ChangePasswordBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { currentPassword, newPassword } = result.data;
  const user = req.user!;

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.status(200).json({ message: "Password changed successfully" });
});

// GET /user/storage
router.get("/user/storage", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const percentage = (user.storageUsed / user.storageLimit) * 100;
  res.status(200).json({
    used: user.storageUsed,
    limit: user.storageLimit,
    percentage: Math.round(percentage * 10) / 10,
  });
});

// GET /user/activity
router.get("/user/activity", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const logs = await db.query.activityLogsTable.findMany({
    where: eq(activityLogsTable.userId, req.userId!),
    orderBy: [desc(activityLogsTable.createdAt)],
    limit: 20,
  });

  res.status(200).json(logs.map(log => ({
    id: log.id,
    action: log.action,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  })));
});

export default router;
