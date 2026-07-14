import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const reservedUsernamesTable = pgTable("reserved_usernames", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const maintenanceModeTable = pgTable("maintenance_mode", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  message: text("message").notNull().default("The system is under maintenance. Please try again later."),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReservedUsernameSchema = createInsertSchema(reservedUsernamesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertReservedUsername = z.infer<typeof insertReservedUsernameSchema>;
export type ReservedUsername = typeof reservedUsernamesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type SystemLog = typeof systemLogsTable.$inferSelect;
