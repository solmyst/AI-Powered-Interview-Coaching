# Capacity: how many interviews at once

Measured on 2026-11-28 with `scripts/load-nvidia.mjs` (scoring) and a raw burst test (see the table).

## The hosted NVIDIA model

| Test | Result |
|---|---|
| One scoring pass for one answer (1 reference + 3 judgements, in parallel) | 5.9 s |
| Burst of 40 tiny requests in one second | all 40 succeed |
| Burst of 60 | 42 succeed, 18 return 429 |
| 10 answers scored at once, before the limiter | 6 of 10 failed with 429; with 20 at once, none succeeded |
| 10 answers scored at once, with the limiter | 10 of 10 succeed, 64 s in total (the limiter spreads them out) |

So the hosted endpoint allows about **40 requests a minute**, with no rate-limit headers to tell you. This is NVIDIA's free API catalog tier, meant for prototyping.

## What one interview costs in model calls (4 questions)

- 1 reply call per answer (decide chat or answer, write the next question): about 5
- Scoring per answer: 3 judgements, plus 1 reference outline per question not seen before: about 13
- Final report: 1
- About **20 calls per interview** (about 10 before the evaluation rebuild).

## What that means

- 40 calls a minute is about 2,400 an hour, so about **100 interviews an hour at best**, and only if they are spread evenly. A group starting together (a shared link sent to a class) queues, and the last candidates wait minutes for scoring.
- **100 to 200 interviews an hour needs about 70 to 130 calls a minute** with headroom. The free tier cannot carry that. Move to a paid inference plan with a higher limit, then set `AI_RPM`.
- Candidates are protected: replies go before scoring in the queue. Scoring is background work, so a long queue delays the report, not the conversation.
- Cheaper without changing the plan: `SCORING_SAMPLES=2` cuts about a third of scoring calls.

## Switching models or providers

`NVIDIA_BASE_URL` (any OpenAI-compatible host), `NVIDIA_MODEL`, `NVIDIA_API_KEY` and `AI_RPM` are environment settings. Compare candidates with `node --env-file=.env scripts/probe-scoring.mjs ../server/scoring.js` and `scripts/probe-interviewer.mjs`: the new model should keep junk answers at 0, generic answers near 20 and give the same level on repeated runs.

## Other limits (not measured)

- Speech to text (AssemblyAI) and speech synthesis (Sarvam): about 4 and about 8 to 10 calls per interview. Check each account's concurrency and monthly limits before a large batch.
- The server (2 vCPU, 8 GB, one Node process, SQLite) was at a load of 0.2 and is not the bottleneck at this scale. Back up the database before a large batch.
