# Second Brain MVP Demo Runbook

Use this when preparing the local/demo environment. The goal is to make the demo repeatable: seed data, pre-index memory, verify readiness, then rehearse the same questions.

## 1. Required env

The demo seed needs a demo email. If the user has already logged in once and `/api/auth/sync` created a row in `users`, the seed script will resolve `supabaseId` from `DEMO_USER_EMAIL`.

```bash
DEMO_USER_EMAIL="<demo user email>"
DEMO_DISPLAY_NAME="Demo User"
DEMO_ANCHOR_DATE="2026-07-14"
```

If the app user does not exist yet, either log in once with the demo account before running the seed, or set the auth UUID explicitly:

```bash
DEMO_SUPABASE_USER_ID="<supabase auth user uuid>"
```

The indexing drain also needs:

```bash
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
REDIS_URL="redis://localhost:6379"
```

Optional Redis tuning:

```bash
REDIS_COMMAND_TIMEOUT_MS="500"
SEARCH_REDIS_CACHE_ENABLED="true"
SEARCH_CACHE_TTL_SECONDS="600"
```

## 2. Prepare demo data and memory

```bash
pnpm demo:prepare
```

This runs:

```bash
pnpm demo:seed
pnpm demo:drain
```

`demo:seed` creates:

- 7 diary entries across the demo week
- 3 Calendar events already linked to matching diary entries
- 1 extracted text attachment
- 1 daily summary
- 1 weekly summary
- indexing outbox jobs for diary, calendar, attachment, and summaries

`demo:drain` processes pending indexing jobs so Search can retrieve memory chunks before the live demo.

## 3. Run the app

Open three terminals:

```bash
pnpm --filter @second-brain/api dev
```

```bash
pnpm --filter web dev
```

```bash
pnpm --filter @second-brain/worker dev
```

## 4. Verify readiness

API health:

```bash
curl -i http://localhost:3001/api/health
```

In the web app:

- Open `http://localhost:3000/settings`
- Confirm Health is OK
- Confirm Enterprise Controls are visible
- Confirm Demo readiness is ready or only has non-blocking warnings
- Confirm indexing has no failed/dead-letter jobs

## 5. Rehearse sample questions

Use `docs/demo_questions.json` as the fixed rehearsal set.

Recommended order:

1. What feedback did I receive about the project?
2. What did we work on this week?
3. Which Calendar meetings were linked to my diary?
4. What did the attachment say about the MVP?
5. Tom tat tien do MVP tuan nay cua toi.

For each answer, check:

- The answer is grounded, not generic
- Sources include readable cards
- At least one source has the expected diary/calendar/attachment/summary type
- Debug trace is available in local/dev mode

## 6. If indexing gets stuck

```bash
pnpm demo:reset-indexing
pnpm demo:drain
```

If Gemini quota is exhausted, Search should still show retrieved sources and an extractive fallback answer for the demo questions.
