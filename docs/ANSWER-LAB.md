# Answer Lab and conversational controls

## Product decision

Research checked October 28, 2026: [Huru](https://huru.ai/) advertises conversational follow-ups and answer coaching; [Yoodli](https://yoodli.ai/pricing) offers roleplay and custom rubrics; [CodeSignal](https://codesignal.com/pricing/) combines assessment and learning. We cannot substantiate a market-wide absence of retry or transfer practice. Our product bet is a coherent, inspectable learning loop rather than a claim of being the first.

The experience is: completed interview → select one answer → three observable checkpoints → spoken retry → new constraint → evidence comparison. The lowest average-scored answer is suggested, not prescribed. Users can choose another answer.

## Acceptance and invariants

- Original interview answers and scores never change during rehearsal.
- Each original answer has one persisted coaching plan and at most two practice attempts: retry, then transfer.
- Checkpoints stay fixed across the three answers. Their statuses are AI coaching observations, not calibrated hiring scores.
- Server checks every non-null quote is an exact substring of the relevant transcript. Positive observations require a quote. This verifies provenance, not the correctness of the interpretation.
- Plan/attempt requests require interview ownership, CSRF origin checks and existing user request locking. Plans are idempotent. Attempt count prevents duplicate advancement.
- Provider failure does not save a partial result. Pending spoken responses can be retried; the client reconciles responses that were saved before a connection failure.
- Rehearsal is private and included in normal account export/deletion because it is stored in the owned session document. No schema migration is required; older reports without rehearsals work.
- Voice practice requests microphone access, speaks through the configured voice provider, records through the existing AssemblyAI capture flow, and has no typed-answer field. Camera is unnecessary for this focused practice.
- A transfer scenario changes the task; it is explicitly not a like-for-like numerical improvement claim. The model must be willing to report missing evidence.

The call also supports pause/resume, repeat and plain-language clarification. Exact standalone English commands such as “could you repeat the question”, “pause interview”, and “could you clarify that” are handled as controls rather than scored answers. Buttons remain available. Paused calls resume through the explicit control because recording is paused. Clarification is capped at two per turn, keeps the original assessment question, and does not advance the question count. It is model-generated, so semantic equivalence and absence of hints require continuing evaluation.

## Validation

`npm test` covers ownership, request limits, duplicates, provider failures, unchanged scores and evidence guards. `npm run test:media` covers microphone capture, spoken retry/transfer, persistence on reload, pause/resume/clarification, camera frames, fullscreen and completion. The Answer Lab view is checked at 320/768/1440 px and with axe WCAG 2 A/AA rules.

`node tests/rehearsal-live.js` is an opt-in configured-provider acceptance test. It runs the real application against an isolated in-memory database, including a Hindi/English retry; it does not use production users or records. It proves the integration and evidence contract, not learning efficacy or broad assessment accuracy.

## Practical limits and follow-up work

The current turn-based transcription remains; this release does not claim streaming, barge-in or a new latency SLO. Existing scoring is still a coaching estimate. No employer decisions, billing or campus tenancy are added. Role-specific human calibration, language-parity evaluation and reliable streaming dialogue remain separate substantive work.
