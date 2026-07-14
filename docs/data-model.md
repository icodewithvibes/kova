# Kova — Data Model

Storage: Dexie (IndexedDB) in the MVP, single local owner (`OWNER_ID = "local-owner"`). The
schema is written **as if multi-user**: every row carries `userId`, and every repository/store
query filters by it — the row-level-security shape any future backend needs. Money is stored as
`{ amount: Cents, currency: "USD" }`.

## MVP embedding decisions

Production would normalize these; the MVP embeds them (documented trade-off):
- `paycheck_line_items` → embedded array on `paychecks`
- `budget_allocations` → embedded array on `plans` (budget_plans)
- `note_links` → embedded array on `notes`
- `scenarios` → not persisted at all (pure functions; browsing leaves no records)
- `chat_threads` → implicit (single `thread_main`), messages carry `threadId`
- `tax_estimate_inputs` → not persisted (illustrative adapter is stateless)
- `note_attachments` / voice notes → placeholder architecture only (schema reserved, no UI)

## Tables

| Table | Contents | Sensitive fields | Retention / deletion | Indexes |
|---|---|---|---|---|
| `users` | LocalOwner identity | displayName | hard delete via wipe | `id` |
| `preferences` | focus, region?, memory consent, buffer + future-fund settings | region | hard delete | `id, userId` |
| `paySchedules` | frequency, anchor pay date, employer | employer | hard delete | `id, userId` |
| `paychecks` | SourcedValue fields + embedded line items | ALL (income data) | user-deletable; drafts discarded on cancel | `id, userId, status, createdAt` |
| `paycheckDocuments` | fixture refs only in MVP | image refs (future) | **not retained by default**; `retained` flag explicit | `id, userId, paycheckId` |
| `recurringBills` | name, amount, category, due day | amounts | soft delete (`deletedAt`) | `id, userId, active` |
| `plans` | allocations, safe-to-spend, status, shortfall | ALL | user-deletable | `id, userId, paycheckId, payDate` |
| `goals` | price, saved, contribution, priority | amounts | soft delete | `id, userId, state` |
| `goalContributions` | per-check contributions | amounts | hard delete with goal | `id, userId, goalId, date` |
| `expenses` | label, amount, date, source | amounts | user-deletable | `id, userId, date` |
| `notes` | body, collection, tags, embedded links | free text (may contain anything) | soft delete | `id, userId, collection, updatedAt` |
| `memories` | statement, source, dates, state | preferences | soft delete + audit ("forget") | `id, userId, state` |
| `memoryProposals` | pending AI proposals | statement | resolved rows kept for audit | `id, userId, status` |
| `chatMessages` | bodies, cards, actions, basedOn | free text + amounts | user-deletable via wipe | `id, userId, threadId, createdAt` |
| `auditLogs` | every AI proposal/approval/decline/rejection + plan changes | summaries | append-only until account wipe | `id, userId, createdAt` |
| `providerConfig` | active provider, base URLs | none (no keys ever) | hard delete | `id, userId` |

## Authorization rules

- MVP: repository-level owner scoping (`where("userId").equals(OWNER_ID)`) — structurally
  identical to Postgres RLS `USING (user_id = auth.uid())` for a future sync backend.
- No cross-owner references exist; all foreign keys (`goalId`, `paycheckId`…) resolve within the
  same owner's rows.

## Export / delete

- `exportAllData()` dumps every table to a single JSON file (Settings → Export).
- `deleteAllData()` drops and recreates the database (Settings → Delete everything, confirmed,
  no undo) — the account-deletion foundation.
