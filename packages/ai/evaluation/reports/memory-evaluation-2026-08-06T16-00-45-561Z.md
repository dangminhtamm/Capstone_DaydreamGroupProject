# Second Brain Memory Evaluation Report

Generated at: 2026-08-06T16:00:45.561Z
Dataset: Second Brain MVP Evaluation Dataset
User ID: cca496d3-7c4d-48c5-b1a5-fcd2ea0b8faa
Answer strategy: fast
Retrieval limit: 8

## Executive Summary

- Valid run: YES
- Overall pass: NEEDS ATTENTION
- Retrieval latency p95: 462ms / 500ms
- Recall@5: 90% / 90%
- Citation precision: 39% / 90%
- Summary coverage: 100% / 90%

## Latency

| Metric | Value |
|---|---:|
| Retrieval p50 | 283ms |
| Retrieval p95 | 462ms |
| Total recall p95 (embedding + retrieval) | 1302ms |
| Answer p95 | 812ms |

## Quality

| Metric | Value |
|---|---:|
| Recall@5 | 90% |
| Citation precision | 39% |
| Citation source relevant rate | 90% |
| Answer keyword coverage | 74.6% |
| Confidence OK rate | 90% |
| Summary coverage | 100% |

## Summary Coverage Misses

- None

## Retrieval Misses

- summary-02
- no-data-01

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
- no-data-01

## Runtime Errors

- None

## Notes

- Retrieval latency is measured after query embedding, matching the sub-500ms memory recall target.
- Total recall includes Tuturuuu embedding latency and is reported separately.
- Fast answer strategy avoids live Tuturuuu answer generation; set `MEMORY_REPORT_ANSWER_STRATEGY=deep` for full generation evaluation.
- Runtime-invalid reports are not published unless `MEMORY_REPORT_WRITE_INVALID=1` is set.
- The stable demo artifact is `memory-evaluation-latest-valid.md`.

