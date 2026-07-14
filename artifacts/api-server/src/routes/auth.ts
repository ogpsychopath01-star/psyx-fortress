import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, sessionsTable, activityLogsTable, notificationsTable, reservedUsernamesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { authMiddleware, generateToken, type AuthRequest } from "../middlewares/auth";
import {
  RegisterUserBody,
  LoginUserBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  CheckUsernameQueryParams,
} from "@workspace/api-zod";

const router = Router();

const RESERVED_USERNAMES_STATIC = [
  "admin", "owner", "root", "system", "support", "help", "info", "noreply",
  "postmaster", "abuse", "security", "mail", "email", "contact", "hello",
  "psyx", "webmaster", "hostmaster",
];

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const result = RegisterUserBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { username, password, displayName } = result.data;
  const lowerUsername = username.toLowerCase();

  // Check reserved usernames
  if (RESERVED_USERNAMES_STATIC.includes(lowerUsername)) {
    res.status(400).json({ error: "Username is reserved" });
    return;
  }

  // Check DB reserved usernames
  const dbReserved = await db.query.reservedUsernamesTable.findFirst({
    where: eq(reservedUsernamesTable.username, lowerUsername),
  });
  if (dbReserved) {
    res.status(400).json({ error: "Username is reserved" });
    return;
  }

  const email = `${lowerUsername}@psyx.com`;

  // Check duplicate
  const existing = await db.query.usersTable.findFirst({
    where: or(eq(usersTable.username, lowerUsername), eq(usersTable.email, email)),
  });
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    username: lowerUsername,
    email,
    passwordHash,
    displayName: displayName || username,
    role: "user",
    status: "active",
  }).returning();

  // Welcome notification
  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "announcement",
    title: "Welcome to PSYX MAIL GEN",
    message: `Your mailbox ${email} is ready to use. Start composing emails!`,
  });

  const token = generateToken(user.id);

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const result = LoginUserBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, password, rememberMe } = result.data;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "banned") {
    res.status(403).json({ error: "Account is banned" });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Account is suspended" });
    return;
  }

  // Update last login
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  // Log activity
  await db.insert(activityLogsTable).values({
    userId: user.id,
    action: "login",
    ipAddress: req.ip || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
  });

  // Login notification
  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "account_login",
    title: "New login detected",
    message: `A new login to your account from ${req.ip || "unknown"}`,
  });

  const token = generateToken(user.id, rememberMe);

  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

// POST /auth/logout
router.post("/auth/logout", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  // Invalidate any active sessions for this user
  await db.update(sessionsTable)
    .set({ isActive: false })
    .where(eq(sessionsTable.userId, req.userId!));

  res.status(200).json({ message: "Logged out successfully" });
});

// POST /auth/forgot-password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const result = ForgotPasswordBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { email } = result.data;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });

  // Always return success to prevent email enumeration
  if (user) {
    const resetToken = generateToken(user.id);
    await db.insert(notificationsTable).values({
      userId: user.id,
      type: "security_alert",
      title: "Password reset requested",
      message: `A password reset was requested. Token: ${resetToken}`,
    });
  }

  res.status(200).json({ message: "If that email exists, a reset link has been sent." });
});

// POST /auth/reset-password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const result = ResetPasswordBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { token, password } = result.data;

  try {
    const { default: jwt } = await import("jsonwebtoken");
    const JWT_SECRET = process.env.SESSION_SECRET || "psyx-secret-fallback";
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };

    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, payload.userId));

    await db.insert(notificationsTable).values({
      userId: payload.userId,
      type: "password_changed",
      title: "Password changed",
      message: "Your password was successfully reset.",
    });

    res.status(200).json({ message: "Password reset successfully" });
  } catch {
    res.status(400).json({ error: "Invalid or expired reset token" });
  }
});

// GET /auth/check-username
router.get("/auth/check-username", async (req, res): Promise<void> => {
  const result = CheckUsernameQueryParams.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const { username } = result.data;
  const lowerUsername = username.toLowerCase();

  if (RESERVED_USERNAMES_STATIC.includes(lowerUsername)) {
    res.status(200).json({ available: false, username: lowerUsername, reason: "Username is reserved" });
    return;
  }

  const dbReserved = await db.query.reservedUsernamesTable.findFirst({
    where: eq(reservedUsernamesTable.username, lowerUsername),
  });
  if (dbReserved) {
    res.status(200).json({ available: false, username: lowerUsername, reason: "Username is reserved" });
    return;
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, lowerUsername),
  });

  res.status(200).json({
    available: !existing,
    username: lowerUsername,
    reason: existing ? "Username already taken" : null,
  });
});

// GET /auth/me
router.get("/auth/me", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
