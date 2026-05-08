# Capstone_DaydreamGroupProject
# Second Brain

> The system is designed as a personal intelligence platform rather than a simple diary application. Its value lies in transforming unstructured user data into structured, retrievable memory and generating meaningful long-term insights through hierarchical reflection.


# Key Differentiators

* **Hierarchical Reflection:** Aggregates data from daily entries into weekly and monthly insights.
* **Grounded Memory Retrieval:** Prevents AI hallucination by grounding answers in actual diary chunks and calendar events.
* **Explainable AI:** Provides exact citations and confidence scores for every retrieved answer.
* **Real-world Integration:** Context-aware memory enriched by automated Google Calendar sync.
* **Insight Generation:** Automated pattern detection across the user's timeline.

---

# Project Structure (Monorepo)

* `apps/web` — Next.js frontend (UI/UX & AI Visualization)
* `apps/api` — NestJS backend (Core API, Auth & Security)
* `apps/worker` — Background jobs & workflows
* `packages/ai` — Memory engine, chunking, and retrieval logic
* `packages/shared` — Shared TypeScript types and DTOs
* `packages/db` — Database schemas and vector configurations

---

# Team Ownership Boundaries

* Dang Minh Tam — AI Memory Engine & System Architecture
* Tran Nguyen Quan — Backend Core, API & Security
* Duong Minh Duc Anh — Frontend UI/UX & Explainability Interface
* Nguyen Tan Thang — Workflows & Google Integrations
* Nguyen Thanh Nhan — QA, Demo Data & Platform Support

---

# 🚀 Comprehensive Local Setup

### Prerequisites

*   **Node.js**: v20 or higher
*   **pnpm**: v10 or higher
*   **PostgreSQL**: With `pgvector` extension enabled

### 1. Installation

```bash
git clone https://github.com/dangminhtamm/second-brain.git
cd second-brain
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory (or specific app directories) with the following essential keys:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/second_brain?sslmode=disable"

# Auth (Supabase)
SUPABASE_URL="your-project-url"
SUPABASE_ANON_KEY="your-anon-key"

# Google Integration
GOOGLE_CLIENT_ID="your-google-id"
GOOGLE_CLIENT_SECRET="your-google-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# AI/ML
AI_MODEL_API_KEY="your-api-key"
```

### 3. Database Initialization

```bash
# Generate Prisma Client
pnpm --filter @second-brain/db prisma:generate

# Sync database schema (or use migrations)
npx prisma db push --schema=packages/db/prisma/schema.prisma
```

---

# 🛠️ Development & Running

### Running the Full Stack
Start all applications in parallel:
```bash
pnpm dev
```

### Running Specific Services
```bash
# Frontend only
pnpm --filter web dev

# Backend API only
pnpm --filter @second-brain/api start:dev

# Worker only
pnpm --filter @second-brain/worker dev

# Search service only
pnpm --filter @second-brain/search dev
```

---

# 📜 Development Rules

1.  **Branching Strategy:** Use `feature/<task-name>` for all new features.
2.  **Pull Requests:** No direct pushes to `main`. All code must be reviewed.
3.  **Shared Logic:** Keep shared data contracts and DTOs in `packages/shared`.
4.  **Database Changes:** Always update the schema in `packages/db/prisma/schema.prisma` and run `prisma:generate`.

---

## Frontend Target Structure

```text
apps/
├── search/
│   └── main.ts                  # AI Query API (placeholder)
├── web/                         # Main Frontend (Next.js App Router)
│   └── src/
│       ├── app/                 # Dashboard, Diary, Timeline, Search
│       ├── components/          # UI components
│       └── lib/                 # API client + mock data
└── worker/
    └── src/
        ├── jobs/
        │   ├── sync-calendar/
        │   └── summarize/
        └── index.ts

packages/
├── db/
│   ├── prisma/
│   └── src/
├── ai/
│   └── src/
│       ├── chunking/
│       ├── embeddings/
│       └── prompts/
└── shared/
    └── src/
        ├── types/
        └── utils/
```

## Week 1 Frontend Deliverables (Duc Anh)

- Setup `apps/web` with `src/app`, `src/components`, `src/lib`
- Build `Diary input UI`
- Build `Timeline UI` with mock data
- Provide smooth demo flow between dashboard, diary, timeline
