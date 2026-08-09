# Second Brain Memory Evaluation Report

Generated at: 2026-08-09T06:03:21.625Z
Dataset: Second Brain MVP Evaluation Dataset
User ID: cca496d3-7c4d-48c5-b1a5-fcd2ea0b8faa
Answer strategy: fast
Retrieval limit: 8

## Executive Summary

- Valid run: YES
- Overall pass: PASS
- Retrieval latency p95: 374ms / 500ms
- Recall@5: 90% / 90%
- Citation precision: 91.7% / 90%
- Summary coverage: 100% / 90%

## Latency

| Metric | Value |
|---|---:|
| Retrieval p50 | 269ms |
| Retrieval p95 | 374ms |
| Total recall p95 (embedding + retrieval) | 1162ms |
| Answer p95 | 472ms |

## Quality

| Metric | Value |
|---|---:|
| Recall@5 | 90% |
| Citation precision | 91.7% |
| Citation source relevant rate | 85% |
| Answer keyword coverage | 55% |
| Confidence OK rate | 95% |
| Summary coverage | 100% |

## Summary Coverage Misses

- None

## Retrieval Misses

- no-data-01
- no-data-02

## Citation Precision Below 90%

- decision-02
- frontend-01
- no-data-02

## Runtime Errors

- None

## Notes

- Retrieval latency is measured after query embedding, matching the sub-500ms memory recall target.
- Total recall includes Gemini embedding latency and is reported separately.
- Fast answer strategy avoids live Gemini answer generation; set `MEMORY_REPORT_ANSWER_STRATEGY=deep` for full generation evaluation.
- Runtime-invalid reports are not published unless `MEMORY_REPORT_WRITE_INVALID=1` is set.
- The stable demo artifact is `memory-evaluation-latest-valid.md`.

