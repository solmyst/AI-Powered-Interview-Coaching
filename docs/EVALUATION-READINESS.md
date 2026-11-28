# Evaluation readiness — 28 November 2026

Status: local implementation and synthetic validation only. **Not approved for production scoring or automated hiring decisions.** No deployment or live model configuration change was made for this investigation.

## Findings and local changes

| Problem | Finding | Change |
| --- | --- | --- |
| Inconsistent scores | Creative generation settings also applied to assessment; conflicting scales; partial judge panels were accepted | Assessment temperature 0, one anchored scale, complete 3/5-member panels, repeated rubric order rotations and agreement ranges |
| Top-end compression | Previous maximum was 95; references encouraged extra requirements beyond the question | Maximum 100, criterion-specific scope, independent criterion grading; calibration remains unresolved |
| Invalid evidence | Quotes could be invented, copied incorrectly, or pooled across judges to rescue unsupported ratings | Judges select server-owned transcript span IDs; exact text and offsets are attached by the server; invalid assessments retry once then fail without assigning a candidate zero |
| Off-topic acceptance | A shared keyword bypassed relevance checking | Separate semantic check, neutral redirect, repeated unrelated answers recorded explicitly and scored zero |
| Praise and hints | Model-generated transitions and clarifications could reveal grading or solutions | Controlled neutral transitions and clarification replies in English/Hindi; no forced strengths for empty/off-topic answers |
| Auditability | References could be reused across incompatible contexts | Bounded per-client reference cache keyed by question, rubric, role, experience and model; version, hashes, settings and evidence recorded |

Repeated calls to one model are correlated judgments, not independent experts. Agreement is not a calibrated probability of correctness. Temperature 0 does not guarantee provider-level determinism.

## Observed live results

Same synthetic answers, three evaluations each:

| Fixture | Original method | Final source-span method |
| --- | --- | --- |
| Off-topic | 0 / 0 / 0 | 0 / 0 / 0 |
| Decent | 75 / 54 / 75 | 45 / 45 / 45 |
| Strong | 75 / 75 / 75 | 75 / 75 / 75 |

The final method also returned stable zeros for empty, filler, restatement and confidently wrong fixtures; vague answers scored 20. Stable scores alone do not establish accuracy. The decent and strong fixtures still miss their provisional expected bands. Those bands are illustrative and have not been human validated; they were not adjusted to conceal misses.

Evidence: workspace `outputs/evaluation-baseline.txt`, `outputs/evaluation-source-spans.txt` and `outputs/evaluation-source-spans.json`. Run `scripts/probe-scoring.mjs` for repeatable measurements; JSON explicitly marks humanReviewed and releaseReady false. `PROBE_ENFORCE=1` enables the provisional quality gate.

The live interviewer probe passed 13/14 cases. It caught off-topic responses containing shared keywords and handled Hindi attempts, but incorrectly redirected one wrong-but-relevant payment answer. One Hinglish classification took about 51 seconds. These are release blockers, not passing production evidence. See `outputs/interviewer-relevance-and-speech.txt`. A stronger model comparison also produced evidence-validation failures under the earlier quote-based method; it does not justify a model switch.

## Required next steps

1. Create a human-reviewed question bank with frozen criterion anchors and acceptable alternative solutions at each role and difficulty. Current references are generated and process-cached; they are not durable, expert-approved anchors.
2. Build a bilingual English/Hindi/Hinglish corpus including concise correct answers, partial understanding, confidently wrong answers, unrelated keyword overlap, clarification requests and prompt injection. Use at least two human raters with adjudication and a held-out set.
3. Predeclare acceptable score error, repeated-run spread, top-end discrimination, relevance false-rejection rate, hint leakage, assessment failure rate and latency. Compare identical inputs across fresh processes and provider/model revisions. Keep interviewer speed and grading accuracy as separate objectives.
4. Replace the single relevance decision with a measured, conservative approach that preserves wrong-but-relevant attempts. Do not add a keyword bypass. Validate before trusting off-topic flags for scoring.
5. Run shadow scoring with human review, version all results and flag mixed scoring methods. Do not silently reinterpret historical scores or automatically reject candidates from these scores. Predictive hiring validity has not been established.

Optional `NVIDIA_ASSESSMENT_MODEL` / `OLLAMA_ASSESSMENT_MODEL` separates background grading from the fast interviewer. No alternative grader is selected by this report. Benchmark accuracy, latency and cost before configuring one.

Controlled clarification currently repeats the original question rather than generating an unconstrained explanation. Author-approved clarification variants are a future improvement. Controlled transitions prevent that source of praise/hints; generated question content still needs adversarial leakage testing.

## Verification and rollout

Regression coverage includes source ownership and offsets, Unicode, complete panels, evidence repair without candidate penalties, rubric/model cache boundaries, concise answers, classification failures and neutral speech. API tests cover repeated off-topic handling and report metadata. UI, accessibility and media suites must remain green.

Deploy only after calibration and relevance gates pass on held-out data. Start with shadow results and human review, monitor disagreement/errors/latency, and retain the previous scoring version for rollback. Infrastructure and unit-test success cannot substitute for assessment validity.

## Separate grader model (28 November 2026, anchored-evidence-v3)

Scoring calls can now go to a separate OpenAI-compatible endpoint (`GRADER_BASE_URL`, `GRADER_API_KEY`, `GRADER_MODEL`, `GRADER_RPM`); the interview and relevance checks stay on NVIDIA. Tested through a Bifrost gateway with Gemini models, same synthetic fixtures, three runs each.

The v2 prompt told judges to give the top level unless they could name a gap, so stronger models gave "decent" and "strong" both 100. v3 defines level 3 as a correct, sensible plan with brief reasons, and level 4 as one that also justifies its choices (priority, trade-off, verification or success check).

| Model (v3 prompt) | Junk fixtures | Vague | Decent | Strong | Spread |
| --- | --- | --- | --- | --- | --- |
| gemini/gemini-3.8-flash (chosen) | 0 | 0 | 75 | 100 | 0 |
| gemini/gemini-2.5-pro | 0 | 0 | 83 | 100 | 0 |
| gemini/gemini-3.1-pro-preview | 0 | 14 | 100 | 100 | 0 |

One answer takes about 12 seconds to score (three judges in parallel), which is fine for background scoring. Vague but relevant answers get level 1 (small credit, about 15-20) by product decision (28 November 2026); filler, "I don't know", restatements and off-topic answers stay at 0. These fixtures are still synthetic and not human-reviewed.
