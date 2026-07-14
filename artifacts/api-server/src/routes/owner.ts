import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, emailsTable, sessionsTable, systemLogsTable, maintenanceModeTable,
} from "@workspace/db";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth";
import {
  OwnerGetSystemLogsQueryParams, OwnerRemoveAdminParams,
  OwnerCreateAdminBody, OwnerSetMaintenanceModeBody,
  OwnerGetAllEmailsQueryParams, OwnerGrantAdminByEmailBody,
} from "@workspace/api-zod";

const router = Router();
const ownerAuth = [authMiddleware(), requireRole("owner")];

// GET /owner/stats
router.get("/owner/stats", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  const [totalEmails] = await db.select({ count: sql<number>`count(*)` }).from(emailsTable);
  const [activeSessions] = await db.select({ count: sql<number>`count(*)` }).from(sessionsTable)
    .where(and(eq(sessionsTable.isActive, true), sql`expires_at > now()`));
  const [storageResult] = await db.select({ total: sql<number>`coalesce(sum(storage_used), 0)` }).from(usersTable);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [newUsersWeek] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
    .where(sql`created_at >= ${oneWeekAgo}`);
  const [newUsersToday] = await db.select({ count: sql<number>`count(*)` }).from(usersTable)
    .where(sql`created_at >= ${today}`);
  const [emailsToday] = await db.select({ count: sql<number>`count(*)` }).from(emailsTable)
    .where(sql`created_at >= ${today}`);
  const [emailsWeek] = await db.select({ count: sql<number>`count(*)` }).from(emailsTable)
    .where(sql`created_at >= ${oneWeekAgo}`);

  res.status(200).json({
    totalUsers: Number(totalUsers?.count ?? 0),
    totalMailboxes: Number(totalUsers?.count ?? 0),
    activeSessions: Number(activeSessions?.count ?? 0),
    totalStorage: Number(storageResult?.total ?? 0),
    totalEmails: Number(totalEmails?.count ?? 0),
    failedLoginAttempts: 0,
    newUsersThisWeek: Number(newUsersWeek?.count ?? 0),
    emailsThisWeek: Number(emailsWeek?.count ?? 0),
    emailsToday: Number(emailsToday?.count ?? 0),
    newUsersToday: Number(newUsersToday?.count ?? 0),
    uptimeSeconds: Math.floor(process.uptime()),
    serverHealth: "healthy",
    dbHealth: "healthy",
  });
});

// GET /owner/all-emails
router.get("/owner/all-emails", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = OwnerGetAllEmailsQueryParams.safeParse(req.query);
  const page = result.success ? (result.data.page ?? 1) : 1;
  const limit = result.success ? (result.data.limit ?? 50) : 50;
  const search = result.success ? result.data.search : undefined;
  const userId = result.success ? result.data.userId : undefined;
  const folder = result.success ? result.data.folder : undefined;
  const offset = (page - 1) * limit;

  let query = db
    .select({
      id: emailsTable.id,
      subject: emailsTable.subject,
      fromEmail: emailsTable.fromAddress,
      toEmail: emailsTable.toAddress,
      body: emailsTable.body,
      folder: emailsTable.folder,
      isRead: emailsTable.isRead,
      isStarred: emailsTable.isStarred,
      createdAt: emailsTable.createdAt,
      userId: usersTable.id,
      username: usersTable.username,
    })
    .from(emailsTable)
    .leftJoin(usersTable, eq(emailsTable.userId, usersTable.id));

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(emailsTable.subject, `%${search}%`),
        ilike(emailsTable.fromAddress, `%${search}%`),
        ilike(emailsTable.toAddress, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
      )
    );
  }
  if (userId) conditions.push(eq(emailsTable.userId, userId));
  if (folder) conditions.push(eq(emailsTable.folder, folder as typeof emailsTable.$inferSelect["folder"]));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const emails = await query.orderBy(desc(emailsTable.createdAt)).limit(limit).offset(offset);

  let countQuery = db.select({ count: sql<number>`count(*)` }).from(emailsTable).leftJoin(usersTable, eq(emailsTable.userId, usersTable.id));
  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
  }
  const [totalResult] = await countQuery;

  res.status(200).json({
    emails: emails.map(e => ({
      id: e.id,
      subject: e.subject,
      fromEmail: e.fromEmail,
      toEmail: e.toEmail,
      body: e.body,
      folder: e.folder,
      isRead: e.isRead,
      isStarred: e.isStarred,
      createdAt: e.createdAt.toISOString(),
      userId: e.userId ?? 0,
      username: e.username ?? "unknown",
    })),
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  });
});

// POST /owner/grant-admin-by-email (any domain)
router.post("/owner/grant-admin-by-email", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = OwnerGrantAdminByEmailBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Email required" });
    return;
  }
  const { email } = result.data;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
  if (!user) {
    res.status(404).json({ error: `No user found with email: ${email}` });
    return;
  }
  if (user.role === "owner") {
    res.status(400).json({ error: "Cannot modify owner role" });
    return;
  }
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
  res.status(200).json({ message: `${user.email} granted admin access` });
});

// GET /owner/system-logs
router.get("/owner/system-logs", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = OwnerGetSystemLogsQueryParams.safeParse(req.query);
  const level = result.success ? result.data.level : undefined;
  const page = result.success ? (result.data.page ?? 1) : 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = db.select().from(systemLogsTable);
  if (level) query = query.where(eq(systemLogsTable.level, level)) as typeof query;

  const logs = await query.orderBy(desc(systemLogsTable.createdAt)).limit(limit).offset(offset);
  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(systemLogsTable);

  res.status(200).json({
    logs: logs.map(log => ({
      id: log.id,
      level: log.level,
      message: log.message,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  });
});

// GET /owner/roles
router.get("/owner/roles", ...ownerAuth, async (_req: AuthRequest, res): Promise<void> => {
  res.status(200).json([
    { id: 1, name: "user", permissions: ["read_mail", "compose_mail", "manage_profile"] },
    { id: 2, name: "admin", permissions: ["read_mail", "compose_mail", "manage_profile", "manage_users", "view_audit_logs", "broadcast"] },
    { id: 3, name: "owner", permissions: ["*"] },
  ]);
});

// GET /owner/admins
router.get("/owner/admins", ...ownerAuth, async (_req: AuthRequest, res): Promise<void> => {
  const admins = await db.query.usersTable.findMany({
    where: eq(usersTable.role, "admin"),
    columns: { id: true, username: true, email: true, displayName: true, createdAt: true },
  });
  res.status(200).json(admins.map(a => ({
    id: a.id,
    username: a.username,
    email: a.email,
    displayName: a.displayName,
    createdAt: a.createdAt.toISOString(),
  })));
});

// POST /owner/admins (by userId)
router.post("/owner/admins", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = OwnerCreateAdminBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, result.data.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, result.data.userId));
  res.status(201).json({ message: `${user.username} promoted to admin` });
});

// DELETE /owner/admins/:id
router.delete("/owner/admins/:id", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = OwnerRemoveAdminParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(usersTable).set({ role: "user" }).where(eq(usersTable.id, params.data.id));
  res.status(200).json({ message: "Admin role removed" });
});

// GET /owner/maintenance
router.get("/owner/maintenance", ...ownerAuth, async (_req: AuthRequest, res): Promise<void> => {
  let maintenance = await db.query.maintenanceModeTable.findFirst();
  if (!maintenance) {
    const [created] = await db.insert(maintenanceModeTable).values({}).returning();
    maintenance = created;
  }
  res.status(200).json({ enabled: maintenance.enabled, message: maintenance.message });
});

// POST /owner/maintenance
router.post("/owner/maintenance", ...ownerAuth, async (req: AuthRequest, res): Promise<void> => {
  const result = OwnerSetMaintenanceModeBody.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const { enabled, message } = result.data;
  let maintenance = await db.query.maintenanceModeTable.findFirst();
  if (!maintenance) {
    const [created] = await db.insert(maintenanceModeTable).values({ enabled, message: message || "System under maintenance.", updatedAt: new Date() }).returning();
    maintenance = created;
  } else {
    const [updated] = await db.update(maintenanceModeTable)
      .set({ enabled, message: message || maintenance.message, updatedAt: new Date() })
      .where(eq(maintenanceModeTable.id, maintenance.id)).returning();
    maintenance = updated;
  }
  res.status(200).json({ enabled: maintenance.enabled, message: maintenance.message });
});

export default router;
