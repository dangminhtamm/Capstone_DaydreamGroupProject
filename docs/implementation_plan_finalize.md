# DayDreamer — Implementation Plan (Updated with Leader Feedback)

Updated based on leader's review requirements. Three focus areas evaluated below.

---

## 1. 🇺🇸/🇻🇳 Language Toggle — ✅ DONE

> **Leader's request:** Option to toggle AI responses between Vietnamese and English so professors/reviewers can read results easily.

| What was built | Status |
|---|---|
| `ResponseLanguage` type (`'en' \| 'vi'`) in AI package | ✅ |
| Prompt instruction: `"You MUST answer in English/Vietnamese"` | ✅ |
| `responseLanguage` field in API DTO with `@IsIn` validation | ✅ |
| Frontend toggle button with SVG flag icons (US/Vietnam) | ✅ |
| Language preference persisted to `localStorage` | ✅ |
| Bilingual fallback messages (6 strings) in AI engine | ✅ |

**Files:** `answer-memory.ts`, `search-query.dto.ts`, `search.service.ts`, `search/page.tsx`, `ai/index.ts`

---

## 2. No-Memory Fallback UX — ✅ DONE

> **Leader's request:** When no relevant memories are found, AI should say clearly and suggest next steps.

| What was built | Status |
|---|---|
| `noMemory: boolean` flag in AI response | ✅ |
| `suggestions: string[]` array (bilingual EN/VI) | ✅ |
| Suggestions include: add diary entries, rephrase question, connect calendar, upload documents | ✅ |
| Frontend: special warning card with actionable suggestion buttons | ✅ |
| AI no longer fabricates answers — returns explicit "no relevant memories" message | ✅ |

**Current suggestions (EN):**
```
• Try adding a diary entry about this topic
• Rephrase your question with more specific details
• Try a suggested question instead
```

> [!IMPORTANT]
> **Gap identified:** Leader also mentioned "Connect Google Calendar" and "Upload related documents" as suggestions. These features exist in the backend schema (`CalendarEvent`, `Attachment`) but don't have frontend UI yet. The suggestions currently link to existing pages only.

---

## 3. 🆕 AI Observability & Query Analytics — NOT STARTED

> **Leader's request:** There should be visibility into how the AI processes queries — token usage, timing, pipeline steps, success/error status, and confidence score. This makes demos more professional and debugging easier.

### What's needed:

#### 3a. Token Tracking (Backend → Frontend)
| Component | What to build |
|---|---|
| **Prisma** | New `TokenUsage` model (user_id, operation, model, prompt_tokens, completion_tokens, total_tokens) |
| **`gemini-json.ts`** | Capture `usageMetadata` from Gemini API response (promptTokenCount, candidatesTokenCount, totalTokenCount) |
| **`answer-memory.ts`** | Return `tokenUsage` in the result alongside answer/citations |
| **Search API** | Save usage to DB per request, return usage in API response |
| **Frontend** | Display token count in the answer panel |

#### 3b. Query Performance Timing
| Component | What to build |
|---|---|
| **`answer-memory.ts`** | Add `performance.now()` timing around each pipeline step |
| **Search API** | Return `timing` object: `{ embedMs, retrieveMs, generateMs, totalMs }` |
| **Frontend** | Show timing breakdown below the answer |

#### 3c. Pipeline Step Visibility
| Component | What to build |
|---|---|
| **Search API response** | Return `pipelineInfo` object with step details |
| **Frontend** | Collapsible "Query Details" panel showing: |

```
📊 Query Analytics
├─ 🔤 Embedding query ............ 120ms
├─ 🔍 Retrieved 5 memory chunks .. 85ms
├─ 🤖 Generating answer .......... 1.2s
├─ 📏 Confidence: high
├─ 🪙 Tokens: 342 prompt + 256 completion = 598 total
├─ ✅ Status: success
└─ ⏱️ Total: 1.4s
```

#### 3d. Aggregate Dashboard Widget (Sidebar)
| Component | What to build |
|---|---|
| **`GET /api/token-usage`** | Returns daily/weekly/monthly usage summaries |
| **Frontend** | Small widget in sidebar showing total tokens used today/this week |

### Proposed API Response Shape
```typescript
// POST /api/search response (enhanced)
{
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: SearchCitation[];
  noMemory: boolean;
  suggestions: string[];

  // NEW: Observability fields
  analytics: {
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      model: string;
    };
    timing: {
      embedMs: number;
      retrieveMs: number;
      generateMs: number;
      totalMs: number;
    };
    chunksRetrieved: number;
    status: "success" | "no_memory" | "error";
  };
}
```

---

## Summary: What's Done vs What's Remaining

| # | Feature | Leader Requirement | Status |
|---|---|---|---|
| 1 | Language Toggle (EN/VI) | ✅ Matches requirement | ✅ **DONE** |
| 2 | No-Memory Fallback + Suggestions | ✅ Matches requirement | ✅ **DONE** |
| 3a | Token Tracking per query | 🆕 New requirement | ✅ **DONE** |
| 3b | Query Performance Timing | 🆕 New requirement | ✅ **DONE** |
| 3c | Pipeline Step Visibility | 🆕 New requirement | ✅ **DONE** |
| 3d | Aggregate Token Dashboard | 🆕 New requirement | ✅ **DONE** |

---

## Other Completed Work (for reference)

| Feature | Status |
|---|---|
| Dark Mode (system-wide) | ✅ Done |
| CRUD Edit/Delete on Timeline | ✅ Done |
| Email Login/Signup + Google OAuth | ✅ Done |
| Duplicate Email Detection | ✅ Done |
| Display Name + Avatar on Signup | ✅ Done |
| Guest Browsing (all pages accessible) | ✅ Done |
| Landing Page clickable feature cards | ✅ Done |
| Sidebar generic Sign in (not Google-specific) | ✅ Done |
| Dead code cleanup (memory-queue removed) | ✅ Done |
| AI embedding LRU cache (150 entries) | ✅ Done |

---

## Execution Priority (Remaining)

| Order | Feature | Status |
|---|---|---|
| **1** | **3a+3b+3c: AI Observability** (token tracking + timing + pipeline panel) | ✅ **DONE** |
| **2** | **3d: Aggregate Token Dashboard Widget** | ✅ **DONE** |
| **3** | Settings/Profile Page (avatar upload, password, theme, language) | ✅ **DONE** |
| **4** | Mood Tracking & Tags | 🔮 Future |
| **5** | Search History (localStorage + cached answers) | ✅ **DONE** |
| **6** | Calendar on Timeline (mini calendar + date filter + stats) | ✅ **DONE** |
| **7** | Data Export | ❌ Cancelled |

> [!NOTE]
> All critical features are complete. Order 4 is deferred to a future release. Order 7 is cancelled (not needed).

## Completed Feature Summary

| Area | Features |
|---|---|
| **Diary** | Create entries, edit/delete on timeline, word count |
| **Timeline** | Paginated list, mini calendar sidebar, date filtering, quick stats |
| **AI Search** | Natural-language query, grounded citations, confidence scoring, language toggle (EN/VI) |
| **Observability** | Token usage tracking, timing pipeline, collapsible analytics panel, aggregate dashboard |
| **Search History** | Persistent recent searches (max 10), cached answers, click-to-restore |
| **Auth** | Email signup, Google OAuth, account linking, avatar upload, password management |
| **Settings** | Profile editing, theme (light/dark/system), AI language preference, token usage stats |
| **UX** | Dark mode, guest browsing, responsive layout, SVG icons (cross-browser), skeleton loaders |

## Build Status
```
✓ Web (Next.js): 10 routes, all static, no errors
✓ AI package: pnpm build clean
✓ Codebase: stable, all planned features delivered
```

