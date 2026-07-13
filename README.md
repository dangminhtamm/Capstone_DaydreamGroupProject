# 🧠 Second Brain

**A Personal Intelligence Platform — Not Just a Diary**

_Transform unstructured thoughts into structured, retrievable memory with AI-powered insights._

[![Node.js](https://img.shields.io/badge/Node.js-≥20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-≥10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

</div>

---

## ✨ Key Differentiators

| Feature | Description |
|---|---|
| **Hierarchical Reflection** | Aggregates data from daily diary entries into weekly and monthly AI-generated insights. |
| **Grounded Memory Retrieval** | Prevents AI hallucination by grounding every answer in actual diary chunks and calendar events. |
| **Explainable AI** | Provides exact citation markers (`[S1]`, `[S2]`, …) and confidence scores (`high` / `medium` / `low`) for every retrieved answer. |
| **AI Observability** | Full transparency with token usage tracking, timing pipeline breakdown, and an interactive analytics panel per query. |
| **Semantic Search + History** | Vector-based search using Gemini embeddings with persistent search history and cached answers. |
| **Timeline Calendar** | Mini calendar sidebar on timeline with date-based filtering and entry statistics. |
| **Cross-Platform Auth** | Email + Google OAuth with automatic account linking. Avatar upload, password management for all account types. |
| **Entity Extraction** | Automated detection of people, projects, goals, and habits across memory chunks. |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         pnpm Monorepo                              │
├──────────────────────────┬─────────────────────────────────────────┤
│       Applications       │            Shared Packages              │
│                          │                                         │
│  apps/web     (Next.js)  │  packages/ai     (Memory Engine)        │
│  apps/api     (NestJS)   │  packages/db     (Prisma + pgvector)    │
│  apps/worker  (Cron)     │  packages/auth   (Supabase Strategy)    │
│  apps/search  (Query)    │  packages/shared (Types & DTOs)         │
└──────────────────────────┴─────────────────────────────────────────┘
         │                           │
         ▼                           ▼
   ┌──────────┐            ┌──────────────────┐
   │ Supabase │            │ PostgreSQL       │
   │  Auth    │            │ + pgvector ext   │
   └──────────┘            └──────────────────┘
                                     │
                                     ▼
                           ┌──────────────────┐
                           │  Gemini API      │
                           │  (Embeddings +   │
                           │   Answer Gen)    │
                           └──────────────────┘
```

---

## 📁 Project Structure

```text
Capstone_DaydreamGroupProject/
├── apps/
│   ├── web/                          # Next.js 16 frontend (React 19)
│   │   └── src/
│   │       ├── app/                  # Pages: Diary, Timeline, Search, Summary, Settings
│   │       ├── components/           # UI: DiaryForm, TimelineList, Calendar, DashboardShell
│   │       ├── contexts/             # Auth & Theme React context providers
│   │       └── lib/                  # API client, Supabase helpers
│   │
│   ├── api/                          # NestJS 11 backend (REST API on port 3001)
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/             # Supabase JWT auth guard + Google OAuth
│   │       │   ├── calendar/         # Google Calendar sync & retrieval
│   │       │   ├── diary/            # CRUD for diary entries
│   │       │   ├── search/           # Semantic memory search endpoint
│   │       │   ├── summary/          # AI-generated summaries (daily/weekly/monthly)
│   │       │   ├── timeline/         # User timeline aggregation
│   │       │   └── upload/           # File upload & attachment handling
│   │       ├── prisma/               # PrismaService (DI singleton)
│   │       └── storage/              # Storage service abstraction
│   │
│   ├── worker/                       # Background job runner (node-cron)
│   │   └── src/jobs/
│   │       ├── sync-calendar/        # Periodic Google Calendar sync
│   │       ├── summary/              # Automated summary generation pipeline
│   │       └── linking/              # Diary ↔ Calendar event linking
│   │
│   └── search/                       # Standalone AI query service (placeholder)
│
├── packages/
│   ├── ai/                           # AI Memory Engine (ESM)
│   │   └── src/
│   │       ├── embedding.ts          # Gemini embedding provider (768-dim vectors)
│   │       ├── chunker.ts            # Semantic text chunker
│   │       ├── retrieval.ts          # Hybrid vector + lexical retrieval
│   │       ├── answer-memory.ts      # Grounded answer generation with citations
│   │       ├── memory-indexer.ts     # Diary → MemoryChunk indexing pipeline
│   │       └── gemini-json.ts        # Structured JSON output from Gemini
│   │
│   ├── db/                           # Database layer (Prisma ORM)
│   │   ├── prisma/schema.prisma      # Schema: User, DiaryEntry, MemoryChunk, etc.
│   │   ├── prisma.config.ts          # Prisma config with dotenv loading
│   │   └── src/                      # DB client factory & memory-chunk helpers
│   │
│   ├── auth/                         # Supabase Passport.js JWT strategy
│   │   └── supabase-strategy.ts
│   │
│   └── shared/                       # Shared TypeScript types & DTOs
│       └── src/
│
├── .env                              # Root environment variables
├── pnpm-workspace.yaml               # Workspace definition
└── package.json                      # Root scripts (dev, build)
```

---

## 🗄️ Data Models

| Model | Purpose |
|---|---|
| `User` | Linked to Supabase Auth; stores Google OAuth tokens |
| `DiaryEntry` | Raw text entries with draft/published status |
| `MemoryChunk` | Chunked diary/calendar/email text with 768-dim vector embeddings |
| `CalendarEvent` | Synced Google Calendar events (many-to-many with DiaryEntry) |
| `Summary` | AI-generated reflections (daily, weekly, monthly, yearly) |
| `EntityMention` | Extracted entities (person, project, goal, habit) from chunks |
| `Attachment` | File uploads linked to diary entries |
| `GmailMessage` | Synced Gmail messages (future integration) |

---

## 🌐 Frontend Routes

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Hero page with feature cards |
| `/login` | Login | Email + Google OAuth sign in |
| `/signup` | Sign Up | Email registration with avatar upload and password strength indicator |
| `/diary` | Diary Input | Create new diary entries with word count |
| `/timeline` | Timeline | Browse entries with mini calendar, date filter, and quick stats |
| `/search` | Memory Search | AI-powered semantic search with search history and cached answers |
| `/summary` | Summary | AI-generated daily/weekly/monthly reflections with token usage dashboard |
| `/settings` | Settings | Profile, avatar upload, password management, theme, language |
| `/auth/callback` | Auth Callback | Supabase OAuth redirect handler |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- **PostgreSQL** with the [`pgvector`](https://github.com/pgvector/pgvector) extension enabled
- A [Supabase](https://supabase.com/) project (for Auth & hosted Postgres)
- A [Google Cloud](https://console.cloud.google.com/) project with Calendar API enabled
- A [Gemini API key](https://aistudio.google.com/apikey) for embeddings & answer generation

### 1. Clone & Install

```bash
git clone https://github.com/dangminhtamm/Capstone_DaydreamGroupProject.git
cd Capstone_DaydreamGroupProject
pnpm install
```

### 2. Environment Configuration

Create a **root `.env`** file with the following keys:

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/postgres"

# ── Supabase Auth ─────────────────────────────────────────
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_JWT_SECRET="your-jwt-secret"
SUPABASE_SERVICE_KEY="your-service-role-key"

# ── Google OAuth (Calendar Sync) ──────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/calendar/oauth/callback"

# ── AI / Gemini ───────────────────────────────────────────
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"       # optional, defaults to gemini-embedding-001
GEMINI_ANSWER_MODEL="gemini-2.5-flash"               # optional, defaults to gemini-2.5-flash
```

Create **`apps/web/.env.local`**:

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Database Setup

```bash
# Generate the Prisma client
pnpm --filter @second-brain/db prisma:generate

# Push schema to database (creates/updates tables + pgvector extension)
npx prisma db push --schema=packages/db/prisma/schema.prisma
```

---

## 🛠️ Development

### Run the Full Stack

Start all applications in parallel (web on `:3000`, API on `:3001`, worker, search):

```bash
pnpm dev
```

### Run Individual Services

```bash
# Frontend only
pnpm --filter web dev

# Backend API only
pnpm --filter @second-brain/api dev

# Worker only
pnpm --filter @second-brain/worker dev

# Search service only
pnpm --filter @second-brain/search dev
```

### Useful Scripts

```bash
# AI package — test embedding pipeline
pnpm --filter @second-brain/ai test:embedding

# AI package — test semantic chunker
pnpm --filter @second-brain/ai test:chunker

# DB package — insert sample memory chunks
pnpm --filter @second-brain/db memory:insert-sample

# DB package — test vector similarity search
pnpm --filter @second-brain/db memory:test-search

# Build all packages
pnpm build
```

---

## 🔌 API Endpoints

All endpoints are prefixed with `/api` and require a valid Supabase JWT (`Authorization: Bearer <token>`).

| Method | Endpoint | Module | Description |
|---|---|---|---|
| `POST` | `/api/auth/sync` | Auth | Sync Supabase user to local DB |
| `GET` | `/api/auth/google` | Auth | Initiate Google OAuth flow |
| `GET` | `/api/auth/google/callback` | Auth | Google OAuth callback |
| `GET` | `/api/diary` | Diary | List user's diary entries |
| `POST` | `/api/diary` | Diary | Create a new diary entry |
| `GET` | `/api/search?q=...&limit=10` | Search | Semantic memory search |
| `POST` | `/api/calendar/sync` | Calendar | Sync Google Calendar events |
| `GET` | `/api/calendar/events` | Calendar | Get synced calendar events |
| `GET` | `/api/summary` | Summary | Get AI-generated summaries |
| `POST` | `/api/upload` | Upload | Upload file attachments |

---

## 🧪 Testing

```bash
# Run API unit tests
pnpm --filter @second-brain/api test

# Run AI package tests
pnpm --filter @second-brain/ai test

# Run API e2e tests
pnpm --filter @second-brain/api test:e2e
```

---

## 📐 Development Rules

1. **Branching Strategy** — Use `feature/<task-name>` for all new features.
2. **Pull Requests** — No direct pushes to `main`. All code must be reviewed.
3. **Shared Logic** — Keep shared data contracts and DTOs in `packages/shared`.
4. **Database Changes** — Always update `packages/db/prisma/schema.prisma` and run `prisma:generate`.
5. **AI Package** — The `packages/ai` package is ESM-only (`"type": "module"`). Use `.ts` extensions in imports.
6. **Environment Variables** — Never commit secrets. Use `.env` files (already in `.gitignore`).

---

## 👥 Team

| Member | Responsibility |
|---|---|
| **Dang Minh Tam** | AI Memory Engine & System Architecture |
| **Tran Nguyen Quan** | Backend Core, API & Security |
| **Duong Minh Duc Anh** | Frontend UI/UX & Explainability Interface |
| **Nguyen Tan Thang** | Workflows & Google Integrations |
| **Nguyen Thanh Nhan** | QA, Demo Data & Platform Support |

---

## 📄 License

This project is **UNLICENSED** — intended for academic capstone use only.

