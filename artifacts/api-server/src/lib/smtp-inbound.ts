/**
 * Inbound SMTP server — accepts emails sent to @psyx.com addresses
 * and delivers them to the recipient's inbox in the database.
 *
 * Usage: call startSmtpInbound() once from index.ts after the HTTP server starts.
 *
 * MX record setup (required for external delivery):
 *   You need your domain's DNS MX record pointing to this server's public IP.
 *   Replit blocks port 25, so this is intended to be used behind a relay
 *   such as Cloudflare Email Routing, Mailgun inbound routing, or SendGrid
 *   Inbound Parse — which forward to this server on a custom port (2525).
 *
 * Local testing: telnet localhost 2525
 */

import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";
import { db } from "@workspace/db";
import { emailsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { pushToUser } from "./ws-manager";
import { logger } from "./logger";

const PSYX_DOMAIN = "psyx.com";

/** Extract localpart from a full email address: "foo@psyx.com" → "foo@psyx.com" */
function extractEmail(address: string): string {
  return address.trim().toLowerCase().replace(/^<|>$/g, "").split(" ").pop() || address;
}

async function deliverInbound(parsed: ParsedMail, toAddress: string): Promise<void> {
  const normalizedTo = extractEmail(toAddress);

  // Only accept @psyx.com recipients
  if (!normalizedTo.endsWith(`@${PSYX_DOMAIN}`)) {
    logger.info({ to: normalizedTo }, "SMTP inbound: skipping non-psyx recipient");
    return;
  }

  // Look up the recipient
  const recipient = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, normalizedTo),
  });

  if (!recipient) {
    logger.warn({ to: normalizedTo }, "SMTP inbound: recipient not found");
    return;
  }

  const fromAddress = extractEmail(
    parsed.from?.value?.[0]?.address || parsed.from?.text || "unknown@external.com"
  );

  const subject = parsed.subject || "(no subject)";
  const body = parsed.html || parsed.textAsHtml || `<pre>${parsed.text || ""}</pre>`;

  // Insert into inbox
  const [inboxEmail] = await db.insert(emailsTable).values({
    userId: recipient.id,
    subject,
    fromAddress,
    toAddress: normalizedTo,
    ccAddress: null,
    body,
    folder: "inbox",
    isRead: false,
    isStarred: false,
    hasAttachments: (parsed.attachments?.length ?? 0) > 0,
    replyToId: null,
  }).returning();

  // Update storage usage
  const emailSize = Buffer.byteLength(body, "utf8");
  await db.update(usersTable)
    .set({ storageUsed: sql`${usersTable.storageUsed} + ${emailSize}` })
    .where(eq(usersTable.id, recipient.id));

  // Create in-app notification
  await db.insert(notificationsTable).values({
    userId: recipient.id,
    type: "new_mail",
    title: "New Message",
    message: `From ${fromAddress}: ${subject}`,
    isRead: false,
    emailId: inboxEmail.id,
  });

  // Push real-time WebSocket event
  pushToUser(recipient.id, {
    type: "new_mail",
    emailId: inboxEmail.id,
    fromEmail: fromAddress,
    subject,
    preview: body.replace(/<[^>]+>/g, "").slice(0, 120),
  });

  logger.info({ from: fromAddress, to: normalizedTo, emailId: inboxEmail.id }, "SMTP inbound: delivered");
}

export function startSmtpInbound(port = 2525): SMTPServer {
  const server = new SMTPServer({
    // Allow all — authentication not required for inbound relay
    authOptional: true,
    allowInsecureAuth: true,
    disabledCommands: ["AUTH"],

    onData(stream, session, callback) {
      const toAddresses: string[] = session.envelope.rcptTo.map(addr => addr.address);

      simpleParser(stream)
        .then(async (parsed) => {
          await Promise.all(toAddresses.map(addr => deliverInbound(parsed, addr)));
          callback();
        })
        .catch((err) => {
          logger.error({ err }, "SMTP inbound: parse error");
          callback(err as Error);
        });
    },

    onError(err) {
      logger.error({ err }, "SMTP server error");
    },
  });

  server.listen(port, () => {
    logger.info({ port }, `SMTP inbound server listening (relay to port ${port} for external delivery)`);
  });

  server.on("error", (err) => {
    logger.error({ err }, "SMTP inbound server error — continuing without inbound SMTP");
  });

  return server;
}
