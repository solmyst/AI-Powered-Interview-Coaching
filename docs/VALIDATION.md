# Validation record

## Automated checks

- `npm run lint`: passed for active TypeScript UI, Node server and API tests. Legacy reference code is deliberately excluded.
- `npm run typecheck`: passed.
- `npm test`: 13 tests passed. The original API/provider coverage remains, with added landmark-geometry, aggregation and strict delivery-payload validation tests.
- `npm run build`: passed, including the separately loaded MediaPipe worker with no bundled speech model or inference runtime.
- `npm audit`: zero reported vulnerabilities at verification time (including development dependencies).
- `npm run test:e2e`: 3 Chromium tests passed. Landing/dashboard layouts checked at 320/768/1024/1440 widths; setup at desktop and 320; room/report at all four widths. Registration, profile update, persistent login after reload, history/library empty states and account deletion were exercised. Axe WCAG 2 A/AA checks returned zero violations on landing, setup, room and report. This is an automated subset, not a full accessibility certification.
- Test browser room/report fixtures are explicitly isolated in Playwright and use the recorded synthetic-candidate live result. They do not simulate a production model connection or working voice input.
- `npm run test:media`: exercises Chromium with prerecorded camera/audio fixtures, real MediaPipe analysis, and the AssemblyAI HTTP contract. Live provider verification requires an AssemblyAI key configured only on the server.

## Real model acceptance

Ollama `qwen2.5:7b-instruct` on the local Apple M1 Pro completed:

1. Account creation → a resume-personalized Backend opening question.
2. Three submitted answers, persisted evaluations and contextual follow-ups.
3. A saved final report with eight scores and seven study tasks.
4. Test account deletion after the full run.

Observed request durations: first question ~11.6 seconds; answer turns ~31–34 seconds; report ~57.5 seconds. This proves a working turn-based text pipeline, not low-latency full-duplex voice. Example follow-up asked about invalidation queues versus pub/sub after discussing a Redis inventory cache. The model identified that an answer about load tests did not address that trade-off. Full machine-readable result: `live-smoke-result.json` (synthetic candidate).

The in-app browser separately verified login, resume-after-server-restart, a real Frontend question based on a React/accessibility resume, answer submission, a form-validation follow-up, early report generation, a saved bookmark and revision-library retrieval. Browser speech synthesis entered playback state and responded to Stop playback. Audio fidelity was not instrumented.

A quality check exposed an example answer that was initially advice rather than an answer. The system prompt was tightened. A subsequent real model call returned a substantive first-person example answer; see `live-quality-check.json`. This does not establish expert accuracy across all tracks. Model feedback can still be incomplete or wrong.

## Not verified / deferred

- Live NVIDIA: no API key/model supplied. Adapter request shape, validation and errors were tested with a test double only.
- Physical webcam and microphone hardware were not exercised. The actual browser media pipelines were verified with prerecorded devices; permission-denied and device-disconnect behavior remains implementation-tested rather than cross-device certified.
- No paid entitlements or payments: user explicitly deferred billing.
- No live public deployment, TLS/domain configuration, production load test or backup restore drill.
- No verified email/recovery, PDF/DOCX parsing, code execution, score calibration or cross-browser voice certification.

All results refer to this local installation and recorded checks. The screenshots contain test practice content, not customer testimonials or hiring outcomes.
