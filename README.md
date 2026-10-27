# InterviewAce

A working interview-coaching pilot built from the original Solmyst React application. It uses real Ollama responses, or a configured NVIDIA hosted text model, with a server-owned interview history and evidence-based coaching reports. Billing is deliberately deferred.

## Run locally

Use Node 24 LTS (Node >=22.13 supported), npm, Ollama, and an AssemblyAI API key. From this directory:

```sh
npm ci
npm run setup:vision
cp .env.example .env
ollama serve
# In another terminal, if the model is not installed:
ollama pull qwen2.5:7b-instruct
npm run dev
```

Open **http://localhost:5173**. Use that exact origin (not 127.0.0.1) because mutation requests validate `APP_ORIGIN`. Create an account, select a role and round, optionally add resume text, then begin. No API key is required for Ollama. The first model request can be slower while it loads.

The API listens on loopback port 3001 and Vite proxies `/api` to it. SQLite is created under `data/`. Keep `.env` private. Do not add `NODE_ENV=development` to `.env`: it can cause development React code to be included in Vite builds. Set `NODE_ENV=production` in the deployed server's environment instead.

## Implemented

- Email/password accounts with scrypt password hashes, hashed opaque login tokens, HttpOnly/SameSite cookies, logout and persistent sessions.
- Role, seniority, round, difficulty, industry and company setup; 3–8 questions; optional `.txt` resume upload or pasted context and job description.
- One generated question at a time, content-based evaluations, adaptive follow-ups, answer-version conflict protection, retryable errors and resume-after-reload.
- Reports with eight equally weighted dimensions, per-answer reasoning and example answers, missing concepts, strengths, improvements, and a study plan.
- Dashboard, history, practice-score timeline, bookmarks and revision library. Recent report weaknesses inform new interviews.
- A voice-first interview call: one preflight and Join action, then automatic spoken questions, automatic microphone capture, silence-based turn completion, AssemblyAI English/Hindi transcription, answer submission and adaptive follow-ups. There is no typed-answer form in the interview room.
- A private camera tile with on-device MediaPipe face/pose landmarks and a separate delivery report for face visibility, approximate lens direction, framing and alignment. Video, frames and landmarks are never saved; InterviewAce does not retain raw audio.
- AssemblyAI Universal-3.5 Pro Sync transcription and browser speech synthesis for the interviewer. Clear Speaking, Listening and Thinking states prevent turn-taking ambiguity.
- Self-reported confidence check-ins. The application deliberately does not claim to infer confidence or emotion from a face.
- Profile edits, JSON export, individual interview deletion and full account deletion.
- Durable daily session caps, request and sign-in rate limiting, same-origin mutation checks, schema validation, bounded AI concurrency, timeout handling, transient HTTP retries, token usage tracking and logs without answer bodies or credentials.

The original cream/clay palette and editorial typography are retained, with a quiet green accent for the practice workspace. Original prototype modules live in `legacy/` for reference and are excluded from the bundle. Old browser IndexedDB records remain untouched; they are not silently converted into semantic answer scores.

## Environment

| Variable                | Default / purpose                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `PORT`                  | `3001`, API and production static server                                            |
| `HOST`                  | `127.0.0.1`; use `0.0.0.0` only in a properly isolated deployment                   |
| `APP_ORIGIN`            | `http://localhost:5173`; exact public HTTPS origin in production, no trailing slash |
| `DATABASE_PATH`         | `./data/interviewace.db`; persistent local disk                                     |
| `AI_PROVIDER`           | `ollama` or `nvidia`                                                                |
| `OLLAMA_URL`            | `http://127.0.0.1:11434`; trusted operator-configured endpoint                      |
| `OLLAMA_MODEL`          | `qwen2.5:7b-instruct`                                                               |
| `AI_TIMEOUT_MS`         | `120000` per request attempt                                                        |
| `DAILY_INTERVIEW_LIMIT` | `5` successful session starts per user per UTC day                                  |
| `NVIDIA_API_KEY`        | Server-only key; needed only for NVIDIA                                             |
| `NVIDIA_MODEL`          | Exact model ID available to the NVIDIA account                                      |
| `ASSEMBLYAI_API_KEY`    | Server-only key required for spoken-answer transcription                            |
| `ASSEMBLYAI_MODEL`      | `universal-3-5-pro`; English/Hindi Sync transcription                               |
| `ELEVENLABS_API_KEY`    | Server-only key for the consistent Maya interviewer voice                           |
| `ELEVENLABS_MODEL`      | `eleven_v4_turbo`; expressive low-latency multilingual TTS                          |
| `ELEVENLABS_VOICE_ID`   | `EXAVITQu4vr4xnSDxMaL` (Sarah); browser TTS is the automatic fallback               |
| `NODE_ENV`              | Set to `production` on deployment for Secure cookies and HTTPS enforcement          |

### NVIDIA

Configure locally, without sharing the key in chat or committing it:

```dotenv
AI_PROVIDER=nvidia
NVIDIA_API_KEY=your_key_here
NVIDIA_MODEL=your_selected_catalog_model_id
```

Restart the API. The adapter uses `https://integrate.api.nvidia.com/v1/chat/completions` with Bearer authorization. Model IDs and account availability differ; choose a chat/instruct model from the NVIDIA catalog that reliably follows JSON instructions. The server validates every response against Zod schemas. Invalid or truncated responses produce a recoverable error, never invented interview data. A configured key is not proof of live availability. NVIDIA was contract-tested with a test double; live testing requires your key and model.

References: [NVIDIA LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis), [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md).

## API and storage

`server/app.js` owns identity, access control and interview transitions. `server/db.js` initializes schema version 1: users, login sessions, interviews, usage and bookmarks. `server/ai.js` is the only model-network boundary. `server/schemas.js` defines inputs and model outputs. React renders saved server results; it cannot set scores or usage counts.

- `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/session`
- `GET/PATCH/DELETE /api/me`; `GET /api/me/export`
- `GET/POST /api/interviews`; creation requires a UUID `Idempotency-Key`
- `GET/DELETE /api/interviews/:id`
- `POST /api/interviews/:id/answers` with `{answer, expectedTurn}`
- `POST /api/interviews/:id/report` (also supports finishing early after one answer)
- `POST /api/interviews/:id/bookmarks` with `{turn, saved}`; `GET /api/bookmarks`
- `GET /api/health` for model configuration/availability

Every mutation requires an `Origin` matching `APP_ORIGIN`. All personal-data routes require a cookie. Interview state is `active → report_pending → complete`; early reports may transition directly from active to complete. A failed generation leaves the previous saved state untouched. Creation retries reuse their UUID; answer retries use the expected turn; report requests return the existing report after completion. No external code execution occurs.

Usage counts successful starts, not retries, resumes or deletion. Output and input token counters are persisted when a generation is saved. There are at most two in-flight model requests and one mutation per user per process. HTTP 429/502/503 gets one short retry; invalid JSON and transport timeouts require explicit user retry. Responses are limited to 2,200 model output tokens. To bound follow-up/report context, prior answers are excerpted to 2,500 characters and prior rationales to 500 characters; full answers remain in the database and are evaluated in full on submission. Long-answer final summaries can miss details outside those excerpts.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit
npx playwright install chromium
npm run test:e2e
# Optional prerecorded camera/microphone pipeline; requires setup:media and Ollama:
npm run test:media
# Optional real-provider acceptance run; requires the API and Ollama:
npm run test:live
```

Unit/integration fixtures are test-only and never used in the application. The live acceptance script creates a disposable local account, runs three real model turns and a report, writes `docs/live-smoke-result.json`, and deletes its account. The file is explicitly a synthetic-candidate test artifact, not customer data or a testimonial. See `docs/VALIDATION.md` for observed results and limitations.

## Deployment and launch readiness

See [DEPLOYMENT.md](DEPLOYMENT.md) for persistent-disk hosting, HTTPS, backups, and a production smoke check. This is a functioning pilot, **not a claim that public SaaS launch checks are complete**. It must be deployed as a Node service; static GitHub Pages is not suitable. CI validates code rather than publishing an incomplete static app.

Known limits: no payments, email verification or password recovery; `.txt` resume upload only; no sandboxed code execution; this is turn-based voice rather than interruptible full-duplex audio; browser/hardware support varies; gaze is an approximate direction signal, not calibrated eye tracking; AI scores are uncalibrated coaching estimates. Headphones are recommended to keep synthesized interviewer speech out of microphone capture. See [docs/ROADMAP.md](docs/ROADMAP.md).
