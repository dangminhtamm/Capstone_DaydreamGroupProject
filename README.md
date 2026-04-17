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

# Local Setup

## 1. Clone the repository

```bash
git clone https://github.com/dangminhtamm/second-brain.git
cd second-brain
```

## 2. Install dependencies (monorepo)

```bash
npm install
```

## 3. Run backend

```bash
cd apps/api
npm run start:dev
```

## 4. Run frontend

```bash
cd apps/web
npm run dev
```

## 5. (Optional) Run worker

```bash
cd apps/worker
npm install
```

---

# Development Rules

* Do not push directly to `main`
* Use feature branches: `feature/<task-name>`
* Keep shared data contracts in `packages/shared`
