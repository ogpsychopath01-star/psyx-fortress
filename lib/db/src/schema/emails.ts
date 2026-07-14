import { pgTable, serial, text, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const emailFolderEnum = pgEnum("email_folder", ["inbox", "sent", "drafts", "spam", "trash", "starred"]);

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull().default("(no subject)"),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  ccAddress: text("cc_address"),
  body: text("body").notNull().default(""),
  folder: emailFolderEnum("folder").notNull().default("inbox"),
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  hasAttachments: boolean("has_attachments").notNull().default(false),
  replyToId: integer("reply_to_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id").notNull().references(() => emailsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  size: integer("size").notNull().default(0),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emailsTable.$inferSelect;
export type Attachment = typeof attachmentsTable.$inferSelect;
