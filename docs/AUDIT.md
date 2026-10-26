# Repository audit and implementation plan

## Baseline (2026-10-25)

React 18 / TypeScript / Vite 5, Tailwind, Lucide, Recharts, browser IndexedDB; MediaPipe and browser Whisper utilities. Terroir cream/clay visual identity is worth preserving. There is no backend, Firebase dependency, verified identity, server database, or subscription service despite README claims. Guest identity and API keys are in localStorage. Questions are fixed lists; follow-up errors can return random canned questions. Content scores derive from speech/face metrics, not answer correctness. Camera and fullscreen gates block text-only use. Static GitHub Pages cannot host a secure API. Landing ratings and user counts lack evidence.

## Priorities and phases

1. Add a same-origin Node API, SQLite migrations, password hashing, opaque HttpOnly sessions, ownership checks, origin protection, rate limits and durable usage counters. Keep React/Vite and existing palette.
2. Implement a server-owned interview state machine: setup → one generated question → answer evaluation and contextual follow-up → persisted report. Bounded model context, validated structured output, explicit failure recovery, concurrency protection and no synthetic fallback results.
3. Build responsive landing, onboarding/auth, dashboard, setup, room, report, history, bookmarks, progress and profile. Retain old local records as legacy data; do not relabel telemetry scores as semantic evaluation.
4. Add optional browser dictation and speech synthesis, interruption and denied-permission fallbacks. Verify real Ollama flow, API security, persistence, failure paths, responsive UI and accessibility.
5. Provide deployment, privacy and model limitations documentation. Billing explicitly deferred by user; no checkout or paid entitlements in this pass.

## Risks / launch gates

Small local models may hallucinate, misgrade or follow injected instructions; validate format, ground feedback in transcript and describe scores as practice estimates. No code execution: code review only. Browser dictation availability varies and may use browser vendor servers. SQLite requires persistent disk and one API instance. Public launch needs verified email/recovery, abuse prevention, backup policy and load testing. Local-only operation can be demonstrated without those external services.
