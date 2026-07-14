---
name: PSYX FORTRESS architecture
description: Durable decisions for the PSYX FORTRESS temp-mail platform (psyx-mail frontend + api-server backend).
---

## Inbound SMTP
- `artifacts/api-server/src/lib/smtp-inbound.ts` uses `smtp-server` + `mailparser` packages.
- Listens on port 2525 (configurable via `SMTP_INBOUND_PORT` env var). Port 25 is blocked by Replit.
- To receive external mail (Gmail, Discord etc.), point your domain's MX relay to forward to port 2525.
- Delivers to local `@psyx.com` users in DB, inserts notification, pushes WS event.

**Why:** Replit blocks port 25 so a standard MTA is impossible. The relay approach lets real external email flow in without needing root/port-25.

## Theme System
- Six themes: `red-black` (default), `light-blue`, `pink`, `white`, `purple`, `green`.
- Applied via `data-theme="<id>"` on `<html>`. White theme also removes `.dark` class (others add it).
- `ThemeProvider` in `artifacts/psyx-mail/src/lib/theme.tsx` persists choice to `localStorage` under key `psyx_theme`.
- `ThemeSwitcher` component in `artifacts/psyx-mail/src/components/theme-switcher.tsx` (popover with swatches, shown in dashboard header).
- Also available in Profile page → "Color Theme" card (left sidebar) — persists to DB via `PATCH /user/profile`.
- CSS tokens in `artifacts/psyx-mail/src/index.css` under per-theme `[data-theme]` blocks.

## Bug fixes applied (July 2026)
- **Star button**: fixed to call `useEmailAction` directly on the single email, not `useBulkEmailAction` with wrong selection.
- **Email body rendering**: detects HTML via regex, renders with `dangerouslySetInnerHTML`; plain text rendered as `<pre>`-style.
- **Draft save**: compose page now uses lenient `draftSchema` (only `toAddress` required) vs strict `sendSchema` for dispatch.
- **Search bar**: animated search input added to inbox toolbar; passes `search` param to `useListEmails`.
- **Profile page**: theme selection card added to left sidebar with color swatches.
- **Pagination**: inbox now shows prev/next controls when total > 20.

## Owner Panel
- Located at `/owner` route, accessible only to users with `role = "owner"`.
- Four tabs: **All Accounts** (searchable user table with ban/suspend/restore), **All Emails** (searchable, paginated), **Admin Registry** (grant/revoke), **System Logs** (level filter).
- All Accounts tab uses raw `fetch` to `/api/admin/users` because generated React Query hook for owner-level user listing may not exist.

## WebSocket Auth
- WS connects to `/api/ws` path on same host.
- On connect, client sends `{ type: "auth", userId, token }` — server verifies JWT, falls back to userId-only in dev.
- Production: unauthenticated sockets are closed after 10s timeout.

## Browser Push Notifications
- `use-realtime-notifications.ts` calls `Notification.requestPermission()` on mount when userId is present.
- Shows `new Notification(...)` on `new_mail` and `announcement` WS events.
- Also shows Sonner toast in-app.

## Production Build / Deployment Export
- Frontend: `PORT=21833 BASE_PATH=/ pnpm --filter @workspace/psyx-mail run build` → `artifacts/psyx-mail/dist/public/`
- API server: `pnpm --filter @workspace/api-server run build` → `artifacts/api-server/dist/`
- Deployment zip: `psyx-fortress-deploy.zip` in workspace root; `deploy/` folder has README, .env.example, nginx.conf.example, ecosystem.config.js.
- **Important**: vite.config.ts throws if PORT or BASE_PATH env vars are not set at build time. Must supply both.

## Key env vars
- `SESSION_SECRET` — JWT secret (in Replit Secrets).
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` — outbound SMTP for external email delivery.
- `SMTP_INBOUND_PORT` — default 2525 for inbound relay.
- `DATABASE_URL` — auto-set by Replit DB.

## Package locations
- Frontend: `artifacts/psyx-mail` (`@workspace/psyx-mail`)
- API: `artifacts/api-server` (`@workspace/api-server`)
- DB schema: `lib/db/src/schema/` — push with `pnpm --filter @workspace/db run push`
- API types: `lib/api-zod` (server Zod) + `lib/api-client-react` (React Query hooks)
- OpenAPI spec: `lib/api-spec/openapi.yaml` — codegen: `pnpm --filter @workspace/api-spec run codegen`
