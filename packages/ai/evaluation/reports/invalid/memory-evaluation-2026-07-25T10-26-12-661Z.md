# Second Brain Memory Evaluation Report

Generated at: 2026-07-25T10:26:12.660Z
Dataset: Second Brain MVP Evaluation Dataset
User ID: 199fbb7a-45e8-4ee0-adba-ed3ed3005672
Answer strategy: fast
Retrieval limit: 8

## Executive Summary

- Valid run: NO
- Overall pass: NEEDS ATTENTION
- Retrieval latency p95: 0ms / 500ms
- Recall@5: 0% / 90%
- Citation precision: 10% / 90%
- Summary coverage: 0% / 90%

## Latency

| Metric | Value |
|---|---:|
| Retrieval p50 | 0ms |
| Retrieval p95 | 0ms |
| Total recall p95 (embedding + retrieval) | 0ms |
| Answer p95 | 182ms |

## Quality

| Metric | Value |
|---|---:|
| Recall@5 | 0% |
| Citation precision | 10% |
| Citation source relevant rate | 10% |
| Answer keyword coverage | 3.3% |
| Confidence OK rate | 10% |
| Summary coverage | 0% |

## Summary Coverage Misses

- weekly-2026-05-11: Capstone kickoff roles were assigned
- weekly-2026-05-11: Mentor Linh said onboarding copy was confusing
- weekly-2026-05-11: POST /diary saves raw entry before indexing
- weekly-2026-05-11: Attachment upload should cover PDF and plain text
- weekly-2026-05-11: Generated answers must include sources/citations
- weekly-2026-05-11: Timeline moved from mock data to real entries
- weekly-2026-05-11: Calendar sync linked Capstone Mentor Review
- weekly-2026-05-11: Duplicate summaries/idempotency were a risk
- weekly-2026-05-11: 500ms memory recall must be measured separately
- weekly-2026-05-11: Demo rehearsal covered diary, search, tasks, weekly reflection

## Retrieval Misses

- timeline-01
- timeline-02
- feedback-01
- feedback-02
- task-01
- task-02
- calendar-01
- calendar-02
- summary-01
- summary-02
- memory-01
- memory-02
- decision-01
- decision-02
- frontend-01
- workflow-01
- temporal-01
- temporal-02
- no-data-01
- no-data-02

## Citation Precision Below 90%

- timeline-01
- timeline-02
- feedback-01
- feedback-02
- task-01
- task-02
- calendar-01
- calendar-02
- summary-01
- summary-02
- memory-01
- memory-02
- decision-01
- decision-02
- frontend-01
- workflow-01
- temporal-01
- temporal-02

## Runtime Errors

- [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent: [401 Unauthorized] Request had invalid au

## Notes

- Retrieval latency is measured after query embedding, matching the sub-500ms memory recall target.
- Total recall includes Gemini embedding latency and is reported separately.
- Fast answer strategy avoids live Gemini answer generation; set `MEMORY_REPORT_ANSWER_STRATEGY=deep` for full generation evaluation.

