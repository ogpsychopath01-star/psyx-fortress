import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface ExternalMailOptions {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  html: string;
}

export type DeliveryResult =
  | { success: true }
  | { success: false; reason: string };

function createTransport() {
  const smtpHost = process.env["SMTP_HOST"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? "587");
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

export async function sendExternalEmail(opts: ExternalMailOptions): Promise<DeliveryResult> {
  const transport = createTransport();

  if (!transport) {
    logger.warn("SMTP not configured — external email queued but not delivered");
    return { success: false, reason: "smtp_not_configured" };
  }

  try {
    await transport.sendMail({
      from: `"PSYX FORTRESS" <${opts.from}>`,
      to: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      html: opts.html,
      text: opts.html.replace(/<[^>]+>/g, ""),
    });
    return { success: true };
  } catch (err) {
    logger.error({ err }, "External email delivery failed");
    return { success: false, reason: String(err) };
  }
}

export function isExternalEmail(address: string): boolean {
  return !address.toLowerCase().endsWith("@psyx.com");
}
