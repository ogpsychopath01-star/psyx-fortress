import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, emailsTable, notificationsTable,
  reservedUsernamesTable, auditLogsTable, systemLogsTable,
} from "@workspace/db";
import { eq, ilike, sql, desc, and } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import {
  AdminListUsersQueryParams,
  AdminGetUserParams,
  AdminUserActionParams,
  AdminUserActionBody,
  AdminBroadcastAnnouncementBody,
  AdminAddReservedUsernameBody,
  AdminGetAuditLogsQueryParams,
} from "@workspace/api-zod";

const router = Router();

const adminAuth = [authMiddleware(), requireRole("admin", "owner")];

// GET /admin/users
router.get("/admin/users", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = AdminListUsersQueryParams.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { page, limit, search, status } = result.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  let baseQuery = db.select({
    user: usersTable,
    emailCount: sql<number>`(select count(*) from emails where user_id = users.id)`,
  }).from(usersTable);

  if (search) {
    baseQuery = baseQuery.where(
      ilike(usersTable.username, `%${search}%`)
    ) as typeof baseQuery;
  }

  if (status) {
    baseQuery = baseQuery.where(
      eq(usersTable.status, status as typeof usersTable.$inferSelect["status"])
    ) as typeof baseQuery;
  }

  const users = await baseQuery
    .orderBy(desc(usersTable.createdAt))
    .limit(limit ?? 20)
    .offset(offset);

  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const total = Number(totalResult[0]?.count ?? 0);

  res.status(200).json({
    users: users.map(({ user, emailCount }) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      storageUsed: user.storageUsed,
      emailCount: Number(emailCount ?? 0),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
    total,
    page: page ?? 1,
    limit: limit ?? 20,
  });
});

// GET /admin/users/:id
router.get("/admin/users/:id", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, params.data.id),
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const emailCountResult = await db.select({ count: sql<number>`count(*)` })
    .from(emailsTable)
    .where(eq(emailsTable.userId, user.id));

  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    storageUsed: user.storageUsed,
    emailCount: Number(emailCountResult[0]?.count ?? 0),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /admin/users/:id/action
router.patch("/admin/users/:id/action", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = AdminUserActionParams.safeParse({ id: Number(req.params.id) });
  const body = AdminUserActionBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { action, newPassword } = body.data;
  const targetId = params.data.id;

  // Prevent acting on owner
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === "owner" && req.user?.role !== "owner") {
    res.status(403).json({ error: "Cannot modify owner account" });
    return;
  }

  switch (action) {
    case "suspend":
      await db.update(usersTable).set({ status: "suspended" }).where(eq(usersTable.id, targetId));
      break;
    case "activate":
      await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, targetId));
      break;
    case "ban":
      await db.update(usersTable).set({ status: "banned" }).where(eq(usersTable.id, targetId));
      break;
    case "unban":
      await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, targetId));
      break;
    case "delete":
      await db.delete(usersTable).where(eq(usersTable.id, targetId));
      break;
    case "reset-password":
      if (newPassword) {
        const hash = await bcrypt.hash(newPassword, 12);
        await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, targetId));
      }
      break;
  }

  // Audit log
  await db.insert(auditLogsTable).values({
    adminId: req.userId!,
    action,
    targetType: "user",
    targetId,
    details: action === "reset-password" ? "Password was reset" : null,
  });

  res.status(200).json({ message: `Action '${action}' performed on user ${targetId}` });
});

// GET /admin/stats
router.get("/admin/stats", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "active"));
  const [suspendedResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "suspended"));
  const [bannedResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.status, "banned"));
  const [emailResult] = await db.select({ count: sql<number>`count(*)` }).from(emailsTable);
  const [storageResult] = await db.select({ total: sql<number>`sum(storage_used)` }).from(usersTable);

  // New users today
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [newTodayResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
    .where(sql`created_at >= ${today}`);

  res.status(200).json({
    totalUsers: Number(totalResult.count ?? 0),
    activeUsers: Number(activeResult.count ?? 0),
    suspendedUsers: Number(suspendedResult.count ?? 0),
    bannedUsers: Number(bannedResult.count ?? 0),
    totalEmails: Number(emailResult.count ?? 0),
    totalStorage: Number(storageResult.total ?? 0),
    newUsersToday: Number(newTodayResult.count ?? 0),
    emailsSentToday: 0,
  });
});

// POST /admin/announcements
router.post("/admin/announcements", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = AdminBroadcastAnnouncementBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { title, message } = result.data;
  const allUsers = await db.query.usersTable.findMany({ columns: { id: true } });

  await Promise.all(allUsers.map(user =>
    db.insert(notificationsTable).values({
      userId: user.id,
      type: "announcement",
      title,
      message,
    })
  ));

  await db.insert(auditLogsTable).values({
    adminId: req.userId!,
    action: "broadcast_announcement",
    targetType: "all_users",
    details: title,
  });

  res.status(201).json({ message: "Announcement broadcast successfully" });
});

// GET /admin/reserved-usernames
router.get("/admin/reserved-usernames", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const reserved = await db.query.reservedUsernamesTable.findMany({
    orderBy: [desc(reservedUsernamesTable.createdAt)],
  });

  res.status(200).json(reserved.map(r => ({
    id: r.id,
    username: r.username,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  })));
});

// POST /admin/reserved-usernames
router.post("/admin/reserved-usernames", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = AdminAddReservedUsernameBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [reserved] = await db.insert(reservedUsernamesTable)
    .values({ username: result.data.username.toLowerCase(), reason: result.data.reason })
    .returning();

  res.status(201).json({
    id: reserved.id,
    username: reserved.username,
    reason: reserved.reason,
    createdAt: reserved.createdAt.toISOString(),
  });
});

// GET /admin/audit-logs
router.get("/admin/audit-logs", ...adminAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = AdminGetAuditLogsQueryParams.safeParse(req.query);
  const page = result.success ? (result.data.page ?? 1) : 1;
  const limit = result.success ? (result.data.limit ?? 50) : 50;
  const offset = (page - 1) * limit;

  const logs = await db.select({
    log: auditLogsTable,
    adminUsername: usersTable.username,
  })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.adminId, usersTable.id))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(auditLogsTable);

  res.status(200).json({
    logs: logs.map(({ log, adminUsername }) => ({
      id: log.id,
      adminId: log.adminId,
      adminUsername: adminUsername ?? "unknown",
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  });
});

export default router;
