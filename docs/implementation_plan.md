# 🚀 Master Implementation & 100% Free Deployment Plan

---

## 📌 1. Architecture & Deployment Overview

To achieve **100% free hosting** for the DayDreamer monorepo without Render memory or worker plan restrictions:

```
                               ┌────────────────────────────────┐
                               │       User Web Browser         │
                               └───────────────┬────────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        ▼                                             ▼
       ┌─────────────────────────────────┐           ┌─────────────────────────────────┐
       │      Next.js Frontend (Web)     │           │      Backend Web Service        │
       │       Hosted on Vercel          │           │       Hosted on Render          │
       │          (100% Free)            │           │     (1 Web Service - Free)      │
       └─────────────────────────────────┘           └────────────────┬────────────────┘
                                                                      │
                                                     Runs API & Worker concurrently:
                                                     node apps/api/dist/main.js &
                                                     node apps/worker/dist/index.js
                                                                      │
                                                ┌─────────────────────┴─────────────────────┐
                                                ▼                                           ▼
                                    ┌──────────────────────┐                    ┌──────────────────────┐
                                    │    NestJS API App    │                    │  Node Cron Worker    │
                                    │     (Port 3001)      │                    │ (Background Jobs)    │
                                    └──────────────────────┘                    └──────────────────────┘
```

---

## 📌 2. Completed Work Summary (Phase 1) ✅

### 2.1 Code Cleanup & Dead File Removal
- [x] **`packages/ai/test-gemini.js`** & **`packages/ai/test-gemini.mjs`** — Removed obsolete scratch test files with hardcoded keys.
- [x] **`apps/api/test-diary.ts`** — Removed manual one-off test script.
- [x] **`apps/web/src/lib/mock-data.ts`** — Removed unimported mock data (`mockTimelineEntries`).
- [x] **`packages/db/package-lock.json`** — Untracked npm lockfile from git inside pnpm workspace.

### 2.2 Git & Project Hygiene
- [x] **`.gitignore`** — Updated to exclude `output/`, `tmp/`, `pnpm_tmp/`, `**/package-lock.json`, `.idea/`, `.vscode/`.
- [x] **`.gitattributes`** — Created to enforce LF line endings across source files.
- [x] **`apps/web/next.config.ts`** — Removed `output: "standalone"` for standard Next.js hosting compatibility.

### 2.3 Bug Fixes & Resilience
- [x] **API Client Error Handling** ([api-client.ts](file:///c:/Users/nguye/Downloads/Capstone_DaydreamGroupProject/apps/web/src/lib/api-client.ts#L272-L274)) — Updated `askSearch()` to extract server error messages via `readApiError()`.
- [x] **Sentry Soft-Dependency** — Replaced static Sentry imports with runtime dynamic `require()` across `apps/worker/src/instrument.ts`, `apps/api/src/instrument.ts`, `apps/api/src/app.module.ts`, and `apps/api/src/common/filters/http-exception.filter.ts`.
- [x] **AI Validation Tuning** ([answer-memory-validation.ts](file:///c:/Users/nguye/Downloads/Capstone_DaydreamGroupProject/packages/ai/src/answer-memory-validation.ts)) — Added entity/date tolerance and 100+ common word ignore list to prevent false-positive validation rejections on grounded answers.
- [x] **Prisma Build Resilience** ([prisma.config.ts](file:///c:/Users/nguye/Downloads/Capstone_DaydreamGroupProject/packages/db/prisma.config.ts)) — Added dynamic fallback to `DATABASE_URL` or default string so `prisma generate` never fails during cloud builds.

---

## 📌 3. Step-by-Step 100% Free Deployment Plan

---

### Step 3.1: Deploy Backend (API + Worker) on Render

1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** ➔ **Web Service**.
3. Select your repository: **`nguyentnhan1012rmit/Capstone_DaydreamGroupProject`**.
4. Configure service settings:
   - **Name**: `daydreamer-backend`
   - **Runtime**: `Node`
   - **Region**: `Singapore` (or nearest)
   - **Branch**: `main`
   - **Plan**: `Free`
   - **Build Command**:
     ```bash
     pnpm install && pnpm --filter @second-brain/db prisma:generate && pnpm --filter @second-brain/shared build && pnpm --filter @second-brain/db build && pnpm --filter @second-brain/ai build && pnpm --filter @second-brain/api build:app && pnpm --filter @second-brain/worker build
     ```
   - **Start Command**:
     ```bash
     node apps/api/dist/main.js & node apps/worker/dist/index.js
     ```

5. Under **Environment Variables**, add the following keys from your `.env`:

| Variable Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://prisma.iqbempcnkkggjejegziw:daydreamer@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://prisma.iqbempcnkkggjejegziw:daydreamer@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | `https://iqbempcnkkggjejegziw.supabase.co` |
| `SUPABASE_PROJECT_ID` | `iqbempcnkkggjejegziw` |
| `SUPABASE_JWT_SECRET` | `FO6T6VOWE7clpxVYykcgjZh2DUEocm4jTmgvISjVw4P+caRtuW6mybx9uKxgKzCSloyCa28nuTbv/RlWBZU9+Q==` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxYmVtcGNua2tnZ2plamVneml3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE2MDczNCwiZXhwIjoyMDkxNzM2NzM0fQ.60gQBqICrxwn6SrZSHjy9nvt4XHdhLKQa5hxhwEWexY` |
| `TUTURUUU_AI_API_KEY` | `ttr_ai_c73faed40ac3313f_F-SxYhNJEdya_-iFs9wdFb5-Rz2gn-DQhAx7kfZ7n1g` |
| `ADMIN_EMAILS` | `martindang0311@gmail.com` |
| `SECRET_KEY` | `sb_secret_HaHLRTn63gnOXkWdBqEpFg_V_6JyDeB` |
| `PUBLISHABLE_KEY` | `sb_publishable_jww21RRqUIptYcrvDRZGBA_q_BMI64j` |
| `PORT` | `3001` |

6. Click **Create Web Service**. Wait ~3-5 minutes for build to complete.
7. Save your Render URL (e.g., `https://daydreamer-backend.onrender.com`).

---

### Step 3.2: Deploy Next.js Web Frontend on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with GitHub.
2. Click **Add New...** ➔ **Project**.
3. Import **`nguyentnhan1012rmit/Capstone_DaydreamGroupProject`**.
4. Configure Project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select **`apps/web`**.
5. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://iqbempcnkkggjejegziw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxYmVtcGNua2tnZ2plamVneml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjA3MzQsImV4cCI6MjA5MTczNjczNH0.rMzQAyJaeW0gpamawXJCeosusGDdxGnceBxfyBGEdfo`
   - `NEXT_PUBLIC_API_URL` = `https://daydreamer-backend.onrender.com` *(from Step 3.1)*
   - `NEXT_PUBLIC_SITE_URL` = `https://your-app-name.vercel.app` *(from Vercel)*
6. Click **Deploy**. Vercel will complete the build in ~1 minute.

---

### Step 3.3: Configure CORS & Auth Redirects

Once both deployments are complete:

1. **Render CORS Configuration**:
   - Go to **Render** ➔ `daydreamer-backend` ➔ **Environment**.
   - Add `CORS_ORIGIN` = `https://your-app-name.vercel.app`
   - Add `FRONTEND_URL` = `https://your-app-name.vercel.app`
   - Click **Save Changes**.

2. **Supabase Redirect URL Configuration**:
   - Go to **[supabase.com](https://supabase.com)** ➔ Your Project ➔ **Authentication** ➔ **URL Configuration**.
   - Under **Redirect URLs**, add: `https://your-app-name.vercel.app/**`
   - Set **Site URL** to: `https://your-app-name.vercel.app`

---

## 📌 4. Verification & Testing Plan

### Automated Build Verification
```bash
pnpm build
```
- [x] Verified locally: `@second-brain/db`, `@second-brain/ai`, `@second-brain/api`, `@second-brain/worker`, `web` all build cleanly with zero errors.

### Production Functional Verification
1. **Health Check**: Visit `https://daydreamer-backend.onrender.com/api/health` — ensure returns `{ status: "ok" }`.
2. **Frontend Load**: Visit `https://your-app-name.vercel.app` — verify landing page and login work.
3. **Auth Flow**: Log in via Supabase Auth / Google OAuth — verify token storage and redirect.
4. **Diary Entry Creation**: Create a new diary entry — verify entry saves to Supabase Postgres.
5. **Worker Execution**: Check Render logs for `[Cron] Triggering Semantic Linking Scan` and `DataIngestionJob` execution logs.
6. **Grounded Search**: Run a query on `/search` — verify AI response returns grounded memory citations.
