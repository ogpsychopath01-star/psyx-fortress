import { Router } from "express";
import { db } from "@workspace/db";
import { emailsTable, attachmentsTable, usersTable } from "@workspace/db";
import { eq, and, desc, ilike, sql, inArray } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import {
  ListEmailsQueryParams,
  ComposeEmailBody,
  GetEmailParams,
  DeleteEmailParams,
  EmailActionParams,
  EmailActionBody,
  BulkEmailActionBody,
} from "@workspace/api-zod";
import { sendExternalEmail, isExternalEmail } from "../lib/mailer";
import { pushToUser } from "../lib/ws-manager";
import { notificationsTable } from "@workspace/db";

const router = Router();

// GET /emails
router.get("/emails", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = ListEmailsQueryParams.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { folder, page, limit, search, unreadOnly } = result.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 20);

  const conditions: ReturnType<typeof eq>[] = [eq(emailsTable.userId, req.userId!)];
  if (folder && folder !== "starred") {
    conditions.push(eq(emailsTable.folder, folder as typeof emailsTable.$inferSelect["folder"]));
  } else if (folder === "starred") {
    conditions.push(eq(emailsTable.isStarred, true));
  }
  if (unreadOnly) {
    conditions.push(eq(emailsTable.isRead, false));
  }

  let query = db.select().from(emailsTable).where(and(...conditions));

  if (search) {
    query = db.select().from(emailsTable).where(
      and(...conditions, ilike(emailsTable.subject, `%${search}%`))
    );
  }

  const emails = await query
    .orderBy(desc(emailsTable.createdAt))
    .limit(limit ?? 20)
    .offset(offset);

  const totalResult = await db.select({ count: sql<number>`count(*)` })
    .from(emailsTable)
    .where(and(...conditions));

  const total = Number(totalResult[0]?.count ?? 0);

  const emailsWithAttachments = await Promise.all(emails.map(async (email) => {
    const attachments = email.hasAttachments
      ? await db.query.attachmentsTable.findMany({ where: eq(attachmentsTable.emailId, email.id) })
      : [];
    return {
      id: email.id,
      subject: email.subject,
      fromAddress: email.fromAddress,
      toAddress: email.toAddress,
      ccAddress: email.ccAddress,
      body: email.body,
      folder: email.folder,
      isRead: email.isRead,
      isStarred: email.isStarred,
      hasAttachments: email.hasAttachments,
      attachments: attachments.map(a => ({
        id: a.id,
        filename: a.filename,
        size: a.size,
        mimeType: a.mimeType,
        url: a.url,
      })),
      replyToId: email.replyToId,
      createdAt: email.createdAt.toISOString(),
    };
  }));

  res.status(200).json({
    emails: emailsWithAttachments,
    total,
    page: page ?? 1,
    limit: limit ?? 20,
  });
});

// POST /emails/compose
router.post("/emails/compose", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = ComposeEmailBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { toAddress, ccAddress, subject, body, isDraft, replyToId } = result.data;
  const user = req.user!;

  // Determine folder
  const folder = isDraft ? "drafts" : "sent";

  // Create sent/draft email for sender
  const [sentEmail] = await db.insert(emailsTable).values({
    userId: user.id,
    subject: subject || "(no subject)",
    fromAddress: user.email,
    toAddress,
    ccAddress: ccAddress ?? null,
    body,
    folder,
    isRead: true,
    isStarred: false,
    hasAttachments: false,
    replyToId: replyToId ?? null,
  }).returning();

  if (!isDraft) {
    if (isExternalEmail(toAddress)) {
      // External delivery is handled below so we can capture + return the result
    } else {
      // Deliver to local @psyx.com inbox
      const recipient = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, toAddress),
      });
      if (recipient) {
        const [inboxEmail] = await db.insert(emailsTable).values({
          userId: recipient.id,
          subject: subject || "(no subject)",
          fromAddress: user.email,
          toAddress,
          ccAddress: ccAddress ?? null,
          body,
          folder: "inbox",
          isRead: false,
          isStarred: false,
          hasAttachments: false,
          replyToId: replyToId ?? null,
        }).returning();

        const emailSize = Buffer.byteLength(body, "utf8");
        await db.update(usersTable)
          .set({ storageUsed: sql`${usersTable.storageUsed} + ${emailSize}` })
          .where(eq(usersTable.id, recipient.id));

        // Create an in-app notification for the recipient
        await db.insert(notificationsTable).values({
          userId: recipient.id,
          type: "new_mail",
          title: "New Message",
          message: `From ${user.email}: ${subject || "(no subject)"}`,
          isRead: false,
          emailId: inboxEmail.id,
        });

        // Push real-time event to connected WebSocket clients
        pushToUser(recipient.id, {
          type: "new_mail",
          emailId: inboxEmail.id,
          fromEmail: user.email,
          subject: subject || "(no subject)",
          preview: body.replace(/<[^>]+>/g, "").slice(0, 100),
        });
      }
    }
  }

  // Build the base response — include externalDelivery so the frontend can show the right feedback
  const baseResponse = {
    id: sentEmail.id,
    subject: sentEmail.subject,
    fromAddress: sentEmail.fromAddress,
    toAddress: sentEmail.toAddress,
    ccAddress: sentEmail.ccAddress,
    body: sentEmail.body,
    folder: sentEmail.folder,
    isRead: sentEmail.isRead,
    isStarred: sentEmail.isStarred,
    hasAttachments: sentEmail.hasAttachments,
    attachments: [],
    replyToId: sentEmail.replyToId,
    createdAt: sentEmail.createdAt.toISOString(),
  };

  if (!isDraft && isExternalEmail(toAddress)) {
    // Re-attempt send so we can capture the result synchronously
    const delivery = await sendExternalEmail({
      from: user.email,
      to: toAddress,
      cc: ccAddress,
      subject: subject || "(no subject)",
      html: body,
    });
    res.status(201).json({ ...baseResponse, externalDelivery: delivery });
  } else {
    res.status(201).json(baseResponse);
  }
});

// GET /emails/stats
router.get("/emails/stats", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const countByFolder = await db.select({
    folder: emailsTable.folder,
    count: sql<number>`count(*)`,
    unreadCount: sql<number>`sum(case when is_read = false then 1 else 0 end)`,
  })
    .from(emailsTable)
    .where(eq(emailsTable.userId, userId))
    .groupBy(emailsTable.folder);

  const stats: Record<string, number> = {
    inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0, total: 0,
  };

  for (const row of countByFolder) {
    stats[row.folder] = Number(row.unreadCount ?? 0);
    stats.total += Number(row.count ?? 0);
  }

  // Count starred
  const starredResult = await db.select({ count: sql<number>`count(*)` })
    .from(emailsTable)
    .where(and(eq(emailsTable.userId, userId), eq(emailsTable.isStarred, true), eq(emailsTable.isRead, false)));
  stats.starred = Number(starredResult[0]?.count ?? 0);

  res.status(200).json(stats);
});

// GET /emails/:id
router.get("/emails/:id", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const params = GetEmailParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const email = await db.query.emailsTable.findFirst({
    where: and(eq(emailsTable.id, params.data.id), eq(emailsTable.userId, req.userId!)),
  });

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  // Mark as read when opened
  if (!email.isRead) {
    await db.update(emailsTable)
      .set({ isRead: true })
      .where(eq(emailsTable.id, email.id));
  }

  const attachments = email.hasAttachments
    ? await db.query.attachmentsTable.findMany({ where: eq(attachmentsTable.emailId, email.id) })
    : [];

  res.status(200).json({
    id: email.id,
    subject: email.subject,
    fromAddress: email.fromAddress,
    toAddress: email.toAddress,
    ccAddress: email.ccAddress,
    body: email.body,
    folder: email.folder,
    isRead: true,
    isStarred: email.isStarred,
    hasAttachments: email.hasAttachments,
    attachments: attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      url: a.url,
    })),
    replyToId: email.replyToId,
    createdAt: email.createdAt.toISOString(),
  });
});

// DELETE /emails/:id
router.delete("/emails/:id", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteEmailParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const email = await db.query.emailsTable.findFirst({
    where: and(eq(emailsTable.id, params.data.id), eq(emailsTable.userId, req.userId!)),
  });

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  if (email.folder === "trash") {
    // Permanently delete
    await db.delete(emailsTable).where(eq(emailsTable.id, email.id));
  } else {
    // Move to trash
    await db.update(emailsTable)
      .set({ folder: "trash" })
      .where(eq(emailsTable.id, email.id));
  }

  res.status(200).json({ message: "Email deleted" });
});

// PATCH /emails/:id/action
router.patch("/emails/:id/action", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const params = EmailActionParams.safeParse({ id: Number(req.params.id) });
  const body = EmailActionBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const email = await db.query.emailsTable.findFirst({
    where: and(eq(emailsTable.id, params.data.id), eq(emailsTable.userId, req.userId!)),
  });

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  const { action } = body.data;
  const updates: Partial<typeof emailsTable.$inferInsert> = {};

  switch (action) {
    case "star": updates.isStarred = true; break;
    case "unstar": updates.isStarred = false; break;
    case "read": updates.isRead = true; break;
    case "unread": updates.isRead = false; break;
    case "restore": updates.folder = "inbox"; break;
    case "spam": updates.folder = "spam"; break;
    case "trash": updates.folder = "trash"; break;
  }

  const [updated] = await db.update(emailsTable)
    .set(updates)
    .where(eq(emailsTable.id, email.id))
    .returning();

  res.status(200).json({
    id: updated.id,
    subject: updated.subject,
    fromAddress: updated.fromAddress,
    toAddress: updated.toAddress,
    ccAddress: updated.ccAddress,
    body: updated.body,
    folder: updated.folder,
    isRead: updated.isRead,
    isStarred: updated.isStarred,
    hasAttachments: updated.hasAttachments,
    attachments: [],
    replyToId: updated.replyToId,
    createdAt: updated.createdAt.toISOString(),
  });
});

// POST /emails/bulk-action
router.post("/emails/bulk-action", authMiddleware(), async (req: AuthRequest, res): Promise<void> => {
  const result = BulkEmailActionBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { ids, action } = result.data;
  const updates: Partial<typeof emailsTable.$inferInsert> = {};

  switch (action) {
    case "star": updates.isStarred = true; break;
    case "unstar": updates.isStarred = false; break;
    case "read": updates.isRead = true; break;
    case "unread": updates.isRead = false; break;
    case "restore": updates.folder = "inbox"; break;
    case "spam": updates.folder = "spam"; break;
    case "trash": updates.folder = "trash"; break;
    case "delete":
      await db.delete(emailsTable).where(
        and(eq(emailsTable.userId, req.userId!), inArray(emailsTable.id, ids))
      );
      res.status(200).json({ message: "Emails deleted" });
      return;
  }

  await db.update(emailsTable)
    .set(updates)
    .where(and(eq(emailsTable.userId, req.userId!), inArray(emailsTable.id, ids)));

  res.status(200).json({ message: "Bulk action performed" });
});

export default router;
