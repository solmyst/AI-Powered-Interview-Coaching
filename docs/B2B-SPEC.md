# Company screening mode — spec

Status: draft for owner review. No code written yet.
Scope: let a company create a role, invite candidates by link, have each candidate take the existing voice interview without a trial account, and review a ranked list with per-candidate evidence. Billing is out of scope; only metering hooks are specified.

Reviewed against: `server/db.js`, `server/app.js`, `server/ai.js`, `server/schemas.js`, `server/rehearsal.js`, `src/App.tsx`, `src/product/Room.tsx`, `src/product/vision/CameraCoach.tsx` as of 2026-11-13.

---

## 1. Goals and non-goals

Goals

- A company user creates a **role**: title, job description, rubric (competencies with weights), question count, track, level, invite expiry.
- The company adds candidates (name + email) and gets one **invite link** per candidate.
- The candidate opens the link, reads a plain-language **AI and monitoring disclosure**, gives consent, checks camera and microphone, and takes the same voice interview as today (`Room.tsx`).
- If the candidate disconnects, they reopen the same link and **resume at the current question**.
- The company sees a **ranked list** per role and a **per-candidate report**: full transcript, per-question rubric scores, evidence quotes taken verbatim from the candidate's answers, integrity events, and a human decision field.
- Every advance or reject decision is made by a human. The system never auto-rejects.

Non-goals for this spec

- Billing, plans, payment, invoices (only metering columns are added; see §10).
- Video or audio recording. Video stays on-device as today; audio is sent for transcription only and is not stored.
- ATS integrations (Greenhouse, Lever, Workday), SSO/SAML, scheduled live interviews, coding sandboxes.
- Sending email from the server (MVP: company copies links; see open decision D3).

---

## 2. What exists today (relevant facts)

- **One user type.** `users` + `auth_sessions` with a hashed opaque token in the `ia_session` cookie (`httpOnly`, `sameSite=strict`, 7 days). `auth()` puts the user on `req.user`.
- **Interview state is one JSON blob** in `interviews.data` with `user_id NOT NULL REFERENCES users(id)`. The `owned(req)` helper loads by `id AND user_id`; `save(id, session)` writes it back.
- **Interview loop** (`server/app.js`): `POST /api/interviews` (idempotency key = interview id), `POST /:id/answers` (guarded by `expectedTurn === turns.length`), `POST /:id/clarify` (max 2 per question), `POST /:id/report` (idempotent: returns early if `session.report` exists). Every mutating call runs inside `locked(req.user.id, ...)`, an in-process lock.
- **Answer responses return the whole session**, including each turn's `evaluation` with scores and `modelAnswer`. That is fine for practice; it is a leak for screening (§6.3).
- **Metering** goes to `usage(user_id, day, count, input_tokens, output_tokens, speech_calls)`. `/api/transcribe` and `/api/speech` call `spendSpeech(req.user)` and need a signed-in user.
- **AI prompt** (`server/ai.js`) is written for a "fair interview coach"; it already says not to infer personality, emotion, protected traits or confidence from voice or face, and to treat candidate content as untrusted data. The scale is described as "practice estimates".
- **Fixed 8 scoring dimensions** in `schemas.js` (`correctness`, `depth`, ... `practicality`). `questionCount` is 3–8; `expectedTurn` is capped at 7.
- **Resume after reload already half-works.** Each answer is saved before the next question is generated, `currentQuestion` is stored, and `Room.tsx` reconciles a lost answer response by re-reading the session. What is missing is a way back into the room: the client has no URL routing (`page` is React state), so a reload drops the candidate on the landing page.
- **Vision is on-device.** `CameraCoach` runs MediaPipe with `numFaces: 1` and sends only aggregate counts (`visualSchema`) with each answer.
- **Retention today**: resume and job description are blanked on report completion; `purgeStaleContext()` blanks them on interviews older than 7 days that never completed. Users can export and delete their account.
- Request logs record `req.path`. Anything secret in a URL path ends up in logs.

---

## 3. Roles and auth

### 3.1 Company users

Company users are ordinary `users` rows. They sign in with the existing `/api/auth/*` routes and `ia_session` cookie. Access to company data comes from a membership row, not from a new account type.

- `org_members.role` is `owner` (manage members, roles, retention, delete) or `reviewer` (view candidates, record decisions, review flags).
- New middleware `orgAuth(minRole)` runs after `auth()`: loads the caller's membership for `req.params.orgId` (or the org that owns the role/invite in the URL), returns **404** (not 403) when the caller is not a member, so ids do not leak across orgs.
- Every company query is scoped through `org_id`. No route takes a candidate or role id without joining back to the caller's org.
- MVP onboarding: a signed-in user creates an org and becomes `owner`. Adding a teammate requires the teammate to already have an account; the owner adds them by email. (Email-based member invites come in Phase 2.)
- Company users keep their personal practice history; the two areas are separate screens.

### 3.2 Candidates

Candidates never create an account and never get an `ia_session` cookie.

1. The company creates an invite. The server generates `token = randomBytes(32).toString("hex")`, stores only `hash(token)` (same `sha256` helper as `auth_sessions`), and returns the link once:
   `https://<host>/interviewace/join#t=<token>`
   The token sits in the **URL fragment**, so the browser never sends it to Nginx or Express and it never appears in request logs or `Referer`.
2. The join page reads the fragment, immediately calls `history.replaceState` to drop it from the address bar, and calls `POST /api/candidate/session { token }`.
3. The server checks the invite (exists, not revoked, not expired, role open) and issues a **candidate session**: a second random token stored hashed in `candidate_sessions`, set as cookie `ia_candidate` (`httpOnly`, `sameSite=strict`, `secure` in production, `path=/`, `maxAge` = time until invite expiry, capped at 7 days).
4. Middleware `candidateAuth()` resolves `ia_candidate` to `req.candidate = { inviteId, roleId, orgId }`. It never sets `req.user`.
5. Opening the link again (same or different device) creates a new candidate session for the same invite. That is how resume on another device works. Older candidate sessions for that invite are deleted when a new one is issued, so only one device is live at a time; the takeover is recorded as an integrity event of kind `new_device` (informational).

Invite links are bearer tokens. Anyone holding the link can take the interview. MVP accepts this (same as HackerRank-style links). Optional hardening is open decision D4 (email one-time code before start).

`authLimit` (20 per 15 minutes per IP) also applies to `POST /api/candidate/session` to slow token guessing. 256-bit tokens make guessing impractical anyway.

### 3.3 Shared routes: `/api/transcribe` and `/api/speech`

These now accept **either** principal. New middleware `speaker()`: if `ia_session` resolves, use the user path exactly as today; else if `ia_candidate` resolves to an invite whose screening is `active`, meter to the org (§10); else 401. The candidate speech cap is per invite (default 150 calls per invite), not per day, so one candidate cannot drain the org.

---

## 4. Data model (`server/db.js`)

Migration `user_version` 2 → 3, inside one transaction, following the existing pattern. All new tables; **no existing table is rebuilt or altered**, so existing practice data is untouched.

```sql
CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 180 CHECK (retention_days BETWEEN 30 AND 730),
  created TEXT NOT NULL
);

CREATE TABLE org_members (
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','reviewer')),
  created TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user ON org_members(user_id);

-- One job opening. config holds the setup fields + rubric as validated JSON (§5.1).
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','open','closed')),
  config TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created TEXT NOT NULL
);
CREATE INDEX roles_org ON roles(org_id, created);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','started','completed','expired','revoked','withdrawn')),
  expires INTEGER NOT NULL,             -- epoch ms, same unit as auth_sessions.expires
  consent TEXT,                         -- JSON {version, acceptedAt, items:[...]}; NULL until accepted
  decision TEXT,                        -- JSON {status:'advance'|'hold'|'reject', by, at, note}; human only
  candidate_note TEXT,                  -- optional note from the candidate at the end (≤1000 chars)
  created TEXT NOT NULL,
  UNIQUE (role_id, candidate_email)
);
CREATE INDEX invites_role ON invites(role_id, status);

CREATE TABLE candidate_sessions (
  token TEXT PRIMARY KEY,               -- sha256 of cookie value
  invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

-- Same shape as interviews, but keyed by invite. Kept separate on purpose (see below).
CREATE TABLE screenings (
  id TEXT PRIMARY KEY,
  invite_id TEXT UNIQUE NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  created TEXT NOT NULL,
  state TEXT NOT NULL,                  -- active | report_pending | complete
  score INTEGER,                        -- denormalized weighted overall for ranking; NULL until report
  data TEXT NOT NULL
);

CREATE TABLE integrity_events (
  id INTEGER PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  turn INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tab_hidden','fullscreen_exit','face_absent','multiple_faces','camera_off','paste','reconnect','new_device')),
  duration_ms INTEGER,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  review_note TEXT
);
CREATE INDEX integrity_invite ON integrity_events(invite_id, at);

-- Billing hook only: what each org consumed. Nothing reads it for enforcement in the MVP.
CREATE TABLE org_usage (
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  screenings INTEGER NOT NULL DEFAULT 0,
  speech_calls INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, day)
);
```

Why a separate `screenings` table instead of reusing `interviews`:

- `interviews.user_id` is `NOT NULL` with a foreign key to `users`. Making it nullable in SQLite needs a full table rebuild on the production database, plus re-pointing the `bookmarks` foreign key. A new table needs no rebuild.
- Isolation by construction: every existing practice query (`/api/interviews` list, `/api/me/export`, `purgeStaleContext`, bookmarks, rehearsal) filters `interviews.user_id`, so screening rows can never appear in a candidate's or company user's personal history, and candidate code paths never touch `interviews`.
- Deletion cascades follow the right owner: deleting an org deletes roles → invites → screenings, candidate sessions and integrity events. Deleting a company user's account does not delete candidate data (`created_by` / `reviewed_by` become NULL).

The JSON in `screenings.data` keeps the same top-level shape as a practice session (`id, created, state, setup, currentQuestion, turns, report, clarifications, provider, model`) so `Room.tsx` can render it unchanged. Differences: `turns[].evaluation` uses the screening evaluation schema (§5.2), `report` uses the screening report schema (§5.3), and `previousWeaknesses` is always `[]`.

`questionCount` stays within the existing 3–8 range, so the `expectedTurn ≤ 7` checks keep working.

---

## 5. Role configuration and scoring

### 5.1 Role config (validated with zod, stored in `roles.config`)

```js
roleConfigSchema = z.object({
  // Reuses the enums from shared/interview-options.json via setupSchema.
  role, experience, track, difficulty, industry,   // same as setupSchema
  jobDescription: z.string().trim().min(50).max(6000),
  questionCount: z.number().int().min(3).max(8),
  rubric: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
    label: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(400),   // what "strong" looks like
    weight: z.number().int().min(1).max(5),
  })).min(2).max(6),
  inviteDays: z.number().int().min(1).max(30).default(7),
  candidateFeedback: z.enum(['none','summary']).default('summary'),   // open decision D2
}).strict();
```

`company` in the interview setup is filled from `orgs.name`; the candidate cannot change any setup field. A role's config is frozen once its first invite is started (edits create a new role), so every candidate on a role is scored against the same rubric.

The setup page offers a default rubric per track (e.g. engineering: problem solving, technical depth, communication, practical judgment) that the company edits.

### 5.2 Per-question evaluation for screening

Built per role from the rubric keys:

```js
screeningEvaluationSchema(rubric) = z.object({
  scores: z.object(Object.fromEntries(rubric.map(r => [r.key, score]))),
  evidence: z.array(z.object({
    competency: z.enum(rubric.map(r => r.key)),
    quote: z.string().trim().min(8).max(300),   // verbatim from the answer
    supports: z.enum(['strength','concern']),
  })).max(6),
  rationale: text,
  followUpForHuman: z.string().trim().max(300).optional(), // what a human interviewer should probe
});
```

No `modelAnswer`, `strengths/improvements` or study material: they cost tokens and are not used for screening.

**Evidence quotes are verified on the server.** After generation, each quote is normalized (lowercase, collapse whitespace, strip punctuation) and must be a substring of the normalized answer. Quotes that fail are dropped and counted in `turn.evidenceDropped`. The report shows only verified quotes. This prevents the model from inventing things the candidate never said.

### 5.3 Screening report

Generated once after the last answer (same trigger and idempotency as today's `/report`):

```js
screeningReportSchema = z.object({
  summary: text,                         // 3–5 sentences, evidence-based
  strengths: z.array(text).min(1).max(4),
  concerns: z.array(text).max(4),
  suggestedFollowUps: z.array(text).min(1).max(4),  // questions for the human round
});
```

The server computes, not the model:

- `competencyScores[key]` = rounded mean of that key across answered turns.
- `overall` = weighted mean of `competencyScores` using rubric weights. Stored in `screenings.score` for ranking.
- `answered` / `questionCount`.

### 5.4 Prompt changes (`server/ai.js`)

`ai.generate(schema, task, context, { mode })` gains an optional `mode: 'practice' | 'screening'` (default `practice`, so every existing call is unchanged). In `screening` mode the system prompt:

- opens with "You are InterviewAce, a structured, fair screening interviewer for <company> ..." instead of "interview coach";
- replaces the "practice estimates" scale line with the same numeric bands described as "rubric estimates for a human reviewer";
- adds: score only against the provided rubric; quote evidence verbatim; do not give the candidate feedback, hints or scores during the interview; do not consider accent, fluency in English, filler words, or camera behaviour.

All existing safety lines (untrusted input, no personality or protected-trait inference) stay.

`context()` already sends only question, answer and evaluation to the model, not `delivery`. Keep it that way: delivery metrics (gaze, framing, filler counts) are **never** used for screening scores and are **not shown to companies**. They are an accent/disability bias risk and they were built for self-coaching.

---

## 6. Reusing the interview flow

### 6.1 Server: extract once, mount twice

The four interview handlers (`create`, `answers`, `clarify`, `report`) move out of `createApp` into `server/interview.js` as `registerInterviewRoutes(app, opts)`, the same way `registerRehearsal` is already split out. Mounted twice:

| | Practice (unchanged behaviour) | Screening |
|---|---|---|
| prefix | `/api/interviews` | `/api/candidate/interview` |
| auth | `auth` | `candidateAuth` |
| load/save | `interviews` by `id AND user_id` | `screenings` by `invite_id` |
| lock key | `user.id` | `invite.id` |
| setup | from request body (`setupSchema`) | from `roles.config`; request body ignored |
| limits | daily trial (`usage`, `UNLIMITED_EMAILS`) | invite status + expiry; one screening per invite |
| schemas | `evaluationSchema`, `turnSchema`, `reportSchema` | §5.2, §5.3 |
| metering | `usage` / `recordUsage(user.id)` | `org_usage` / `recordOrgUsage(org.id)` |
| response | full session | `candidateView(session)` (§6.3) |

`opts` is a small object: `{ prefix, auth, load(req), insert(req, session), save(session), lockKey(req), setup(req), limit(req), schemas, meter, view, mode }`. Practice keeps its exact current route paths and responses; the existing `tests/api.test.js` and `tests/limits.test.js` must pass unchanged as the regression gate for the refactor.

Screening-only rules inside the shared handlers:

- `create`: allowed only when invite `status IN ('pending','started')`, consent recorded, not expired, role `open`. Idempotent per invite: if a screening exists, return it (this is the resume path). Sets invite `status='started'`.
- `report`: on success sets invite `status='completed'` and `screenings.score`. Blanks `setup.jobDescription` from the stored session copy (the role row keeps it).
- Rehearsal routes are **not** mounted for screening.

### 6.2 Client: `Room.tsx` gets an API base and a mode

Today `Room` hard-codes `/interviews/${session.id}/...`. Add two props:

```ts
apiBase?: string;              // default `/interviews/${session.id}`; screening: `/candidate/interview`
mode?: 'practice' | 'screening';
```

In `screening` mode:

- Preflight copy changes from "PRIVATE PRACTICE INTERVIEW" to the company + role name, and the "Private by design" line states what the company will see (§7.2). Consent is already done on the previous screen.
- `CameraCoach` keeps running for self-view and the face-presence signal. Its practice wording ("Your interview presence", "See yourself as you practice") changes to neutral screening wording. Today it only reports aggregate counts per answer through `onSummary`; screening needs a new `onPresence(facePresent, faceCount)` callback so `face_absent` can be timed continuously. Its existing "camera off" button stays (candidates must keep control) and turning the camera off records `camera_off`.
- The integrity chip is always visible (§7.2).
- `BriefingDialog` at the end is replaced by a completion screen: "Your interview is submitted to <company>", optional note box (writes `invites.candidate_note`), and the candidate summary if the role allows it (open decision D2). No scores.
- The "end interview early" path still works and submits a partial screening; the company sees "ended early, N of M answered". With zero answers, `endInterview` today calls `back()` without a report; in screening mode that leaves the invite `started` and resumable until expiry.

Everything else (voice turn loop, clarify, pause, repeat, typed answers, reconcile-on-lost-response) is reused as is.

### 6.3 `candidateView(session)`

Candidate responses must never include evaluations, rubric, scores or the report. `candidateView` returns:

```js
{ id, state, created, setup: { role, track, questionCount, company },
  currentQuestion, turns: turns.map(t => ({ question: t.question, answer: t.answer })),
  clarifications }
```

`Room.tsx` only reads `turns.length`, `currentQuestion`, `state` and `setup` during the call, so this is enough. `Session` on the client gets the evaluation fields made optional for this path, or screening uses a narrower `CandidateSession` type.

### 6.4 Client routing

`App.tsx` has no URL routing. Add one branch in `main.tsx`: if `location.pathname` ends with `/join`, render a new `CandidateApp` instead of `App`. `CandidateApp` is a small state machine:

`loading → invalid | expired | disclosure → device check (existing Room preflight) → room → submitted`

It never calls `/api/auth/*` or `/api/interviews`, and it does not listen to `interviewace:session-expired` (a 401 shows "This link has expired or was replaced on another device").

Company screens are new pages inside the existing `App` (`Page` gains `org`, `role`, `candidate`): role list, role editor, candidate table, candidate report.

---

## 7. Candidate experience: consent, AI disclosure, visible proctoring

### 7.1 Disclosure and consent screen (before any device access)

Plain language, one screen, no dark patterns. Content:

- **Who**: "<Company> invited you to a screening interview for <Role>. InterviewAce runs the interview for them."
- **AI**: "The interviewer is an AI. It asks <N> spoken questions, may ask follow-ups, and an AI estimates scores against <Company>'s rubric. A person at <Company> reviews your transcript and makes every decision. The AI does not reject anyone."
- **What is collected**: your spoken answers converted to text (audio is sent to our speech provider for transcription and is not stored by InterviewAce); the transcript; AI scores and quoted evidence; the focus indicators listed below. **No video is recorded or sent**; the camera picture is analysed on your device only to check that a face is present.
- **Focus indicators** (shown as a list, each with the innocent explanation): leaving this tab, leaving full screen, turning the camera off, no face in view for more than 10 seconds, more than one face, pasting text. "These are notes for the reviewer, not automatic penalties. You can explain anything at the end."
- **Retention**: "<Company> keeps your interview for <retention_days> days, then it is deleted." Contact for questions/deletion: the company's contact email (from org settings).
- **Accommodations**: "You can type instead of speaking at any time. If you need another accommodation, contact <Company> before starting."
- **Disconnects**: "If you lose connection, reopen this link before <expiry> to continue from the same question."
- **Expected time**: about `questionCount × 4` minutes.

Two required checkboxes ("I understand an AI conducts and scores this interview and a person reviews it", "I agree to the processing described above") plus a **Decline** button that sets invite `status='withdrawn'` and shows the company contact. Consent is stored in `invites.consent` with the disclosure `version` string and timestamp. Changing the disclosure text bumps the version.

### 7.2 Visible proctoring

Principle: everything monitored is shown to the candidate before and during the interview; nothing is hidden; nothing auto-rejects.

During the call:

- A persistent chip in the call header: "Focus indicators on" → opens the same list as the disclosure.
- When an event is recorded, a non-blocking toast tells the candidate: "You left the tab for 12 s. This is noted for the reviewer. Continue when ready." No warnings counting down to failure.

Events (client-detected, sent in batches to `POST /api/candidate/integrity-events`, validated with zod, max 200 per invite):

| kind | detection | threshold |
|---|---|---|
| `tab_hidden` | `visibilitychange` → hidden | ≥ 3 s, duration recorded |
| `fullscreen_exit` | `fullscreenchange` (only if the candidate entered full screen; full screen is recommended, not required) | any |
| `face_absent` | `CameraCoach` samples with no face | ≥ 10 s continuous |
| `multiple_faces` | `CameraCoach` with `numFaces: 2` in screening mode | ≥ 3 s continuous |
| `camera_off` | candidate turns the camera off with the `CameraCoach` button, or the video track ends | any, duration recorded |
| `paste` | `paste` on the typed-answer box | > 40 characters |
| `reconnect` | new screening `create` call on an existing screening | informational |
| `new_device` | new candidate session on the same invite | informational |

These are browser signals and have innocent causes (notifications, accessibility tools, a child walking in, a poor camera). The company report shows them as a **timeline next to the transcript turn**, grouped and labelled "unreviewed". A reviewer marks each group "no concern" or "concern" with a note. Flag counts never change `score` or ranking order; the ranked list only shows an "unreviewed flags" badge.

Not in scope: eye tracking for cheating, screen recording, browser lockdown, keystroke dynamics, AI-generated-answer detection. These have high false-positive rates and are the main candidate complaint about competitors.

### 7.3 Candidate rights

- The candidate sees their transcript at the end (read only) and can add one note for the reviewer.
- Deletion or access requests go to the company (the company decides on the candidate). The org owner has a "Delete candidate data" action that deletes the invite and cascades. InterviewAce support can do the same on request.
- If `candidateFeedback='summary'`, the candidate sees `strengths` and `suggestedFollowUps` rephrased as "areas to prepare", never scores or the decision.

---

## 8. Resume after disconnect

The server already saves every answered turn and the next question before responding. Resume adds:

1. **Re-entry**: reopening the link → `POST /api/candidate/session` → `POST /api/candidate/interview` returns the existing screening (idempotent per invite) → `Room` opens at preflight with "Resuming at question {turns.length + 1} of {questionCount}". After the device check, the interviewer asks `currentQuestion` again.
2. **Reload without the link**: the `ia_candidate` cookie is still valid, so `/join` without a fragment calls `GET /api/candidate/session` and continues.
3. **Lost in-flight answer**: existing reconcile logic in `submitSpokenAnswer` applies. If the answer never reached the server, the candidate answers the same question again. That is acceptable and is noted as a `reconnect` event.
4. **Report not generated** (candidate closed the tab after the last answer while state was `report_pending`): when a company user opens the candidate, the server generates the report if missing (same idempotent code). Optional Phase 2: a startup sweep.
5. **Limits**: resume is allowed until the invite expires. No cap on the number of reconnects in the MVP; the count is visible to the reviewer. Expired + `active` screenings appear as "Incomplete — N of M answered" with the partial transcript and per-turn scores, without an overall score, and are not ranked.
6. **Concurrency**: the per-invite lock (`locked(invite.id)`) and `expectedTurn` check already stop two tabs from advancing the same question twice. A new device invalidates the old candidate session (§3.2), so the old tab gets 401 and shows "Continued on another device".

The `locks` set is in-process. That is fine on the single VM; Postgres/distributed locks stay on the existing "scale only when needed" roadmap item.

---

## 9. Company API (all JSON, all under `auth` + `orgAuth`)

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/orgs` | any signed-in user | create org; caller becomes owner |
| `GET /api/orgs` | member | orgs the caller belongs to |
| `PATCH /api/orgs/:orgId` | owner | name, `retention_days`, contact email |
| `POST /api/orgs/:orgId/members` / `DELETE .../:userId` | owner | add/remove member (existing account by email) |
| `GET/POST /api/orgs/:orgId/roles` | reviewer / owner | list / create role |
| `PATCH /api/roles/:roleId` | owner | edit while no invite started; status `open`/`closed` |
| `POST /api/roles/:roleId/invites` | reviewer | body `{candidates:[{name,email}]}` (≤ 50); returns links **once** |
| `POST /api/invites/:inviteId/revoke` | reviewer | revoke a pending/started invite |
| `POST /api/invites/:inviteId/reissue` | reviewer | new token + new expiry; old link stops working; keeps progress |
| `GET /api/roles/:roleId/candidates` | reviewer | ranked list (below) |
| `GET /api/invites/:inviteId/report` | reviewer | full report; generates screening report if `report_pending` |
| `POST /api/invites/:inviteId/decision` | reviewer | `{status:'advance'\|'hold'\|'reject', note}`; records `by`, `at` |
| `POST /api/invites/:inviteId/integrity-review` | reviewer | mark events reviewed with note |
| `DELETE /api/invites/:inviteId` | owner | delete candidate data (cascade) |
| `GET /api/roles/:roleId/export.csv` | reviewer | name, email, status, overall, competency scores, decision, unreviewed flags |

Ranked list rules: completed screenings first, sorted by `score DESC`, ties by completion time; then incomplete, then pending, expired, revoked, withdrawn. Each row: name, status, overall (labelled "AI estimate"), competency mini-scores, unreviewed flags count, decision. A header note on every list and report: "Scores are AI estimates against your rubric. Review the transcript before deciding."

Candidate routes (all under `candidateAuth` except the first):

| Method & path | Purpose |
|---|---|
| `POST /api/candidate/session` | `{token}` → cookie + invite summary (company, role title, question count, expiry, disclosure version, consent state) |
| `GET /api/candidate/session` | same summary from cookie (reload path) |
| `POST /api/candidate/consent` | `{version, accepted:true}` or `{declined:true}` |
| `POST /api/candidate/interview` | create-or-resume |
| `POST /api/candidate/interview/answers`, `/clarify`, `/report` | shared handlers |
| `POST /api/candidate/integrity-events` | batch of events |
| `POST /api/candidate/note` | final note, once |

---

## 10. Data retention, deletion and billing hooks

Retention

- `orgs.retention_days` (default 180, range 30–730). A purge runs at startup and on each company sign-in, like `purgeStaleContext()` today: delete invites whose `created` is older than the retention window (cascades to screenings, events, candidate sessions).
- Expired `candidate_sessions` are deleted with the same sweep.
- Job description lives on the role; the per-screening copy is blanked at completion (same as today's practice flow).
- No audio or video is stored, ever, in this spec. Transcription and speech providers (AssemblyAI, Sarvam) receive audio/text in transit; their retention terms must be checked and listed in the disclosure (open decision D6).
- Deleting an org deletes everything under it. Deleting a company user removes their membership only.
- Logs: request logs already exclude bodies; tokens stay out of paths by design (§3.2).

Billing hooks (no enforcement, no payment code)

- `org_usage.screenings` is incremented when a screening is **created** (first question generated), inside the same transaction, mirroring today's `usage.count` increment.
- `recordOrgUsage` and the org speech counter mirror `recordUsage` and `spendSpeech`.
- One place to enforce later: the screening `limit(req)` hook in `registerInterviewRoutes`. MVP returns "allowed" for every org; an env allow-list `SCREENING_ORGS` (org ids) gates who can create roles during the pilot, the same way `UNLIMITED_EMAILS` gates trial caps today.

---

## 11. Compliance notes (not legal advice; owner to confirm)

- The server is in Azure India South Central. India's DPDP Act 2023 treats the company as the data fiduciary and InterviewAce as its processor; the consent screen and deletion path above are written for that model. A short data processing agreement template is needed before paid customers.
- Selling to EU employers brings the EU AI Act: AI used to evaluate job candidates is a high-risk use. Human review, disclosure, logging and bias monitoring in this spec point in the right direction but do not make the product compliant on their own. NYC Local Law 144 (bias audit for automated employment decision tools) applies to NYC hiring. Recommendation: restrict the pilot to India-based hiring until the owner decides otherwise (D7).
- Scores are not calibrated yet (roadmap item 1). Until a calibration study exists, the product must say "AI estimate" everywhere a number appears, and marketing must not claim predictive validity.

---

## 12. Phased build plan

### Phase 0 — refactor with no behaviour change (≈1–2 days)
- Extract interview handlers into `server/interview.js` (`registerInterviewRoutes`) and mount practice routes from it.
- Add `apiBase` prop to `Room.tsx` with the current path as default.
- Add `mode` option to `ai.generate` (practice prompt unchanged).
- Gate: all existing tests (`tests/*.test.js`, Playwright browser tests) pass unchanged; live smoke test passes.

### Phase 1 — MVP: one company, links, reports (≈1.5–2 weeks)
- Migration v3 (all tables in §4).
- Org create, membership (owner only adds existing users), role create/edit with default rubric per track.
- Invites: create, copy link, revoke, reissue. No server email.
- Candidate flow: `/join`, disclosure + consent, device check, screening interview via the shared handlers, `candidateView`, completion screen with note.
- Resume after disconnect (§8 items 1–3, 5, 6) and lazy report generation (item 4).
- Screening evaluation with verified evidence quotes; screening report; weighted overall score.
- Visible proctoring: `tab_hidden`, `fullscreen_exit`, `face_absent`, `camera_off`, `paste`, `reconnect`, `new_device`; in-call chip and toasts; report timeline; reviewer marks events.
- Company screens: role list, ranked candidate table, candidate report (transcript + per-question scores + evidence + flags), human decision with note, CSV export.
- Retention sweep, org delete, candidate delete.
- Metering into `org_usage`; `SCREENING_ORGS` pilot allow-list.
- Tests: API tests for org scoping (member of org A gets 404 on org B's role, invite, report), token handling (hash only, revoked/expired/reissued), `candidateView` never returns evaluation or report fields, one screening per invite, `expectedTurn` race, evidence quote verification, retention purge cascade. One Playwright test: invite → consent → answer 3 typed questions → reload mid-way → resume → company sees ranked report.

### Phase 2 — pilot feedback (≈2 weeks, after 1–2 real companies)
- Server-sent invite and reminder emails (provider per D3), optional email one-time code (D4).
- Member invites by email; reviewer comments per question; side-by-side compare of 2–3 candidates.
- `multiple_faces` detection (MediaPipe `numFaces: 2` in screening mode; check CPU cost on low-end laptops first).
- Optional fixed core questions per role (D1).
- Candidate summary feedback if D2 = yes.
- Startup sweep for `report_pending` screenings.

### Phase 3 — scale and sell
- Calibration study: human-scored sample vs AI scores per rubric; publish inter-rater agreement internally; adverse-impact monitoring by role.
- Billing (plans, entitlements, payment) using `org_usage`.
- SSO, ATS webhooks, audit log of reviewer actions, Postgres when one VM is not enough.

---

## 13. Open decisions for the owner

- **D1. Question consistency.** Today every question after the first adapts to the candidate's last answer, so two candidates for the same role get different questions. That is more natural but harder to compare and to defend as fair. Options: (a) fully adaptive (MVP default, zero extra work); (b) company supplies 2–4 fixed core questions asked to everyone, AI adds follow-ups; (c) fully fixed list. Recommendation: ship (a) for the pilot, build (b) in Phase 2.
- **D2. Feedback to candidates.** Show a short "areas to prepare" summary after submission (addresses the "no feedback" complaint), or nothing? Per-role switch is specced; choose the default. Recommendation: default on, no scores.
- **D3. Email delivery.** MVP has companies copy links. For Phase 2, which provider (Azure Communication Services, SES, Postmark, Resend) and which sending domain?
- **D4. Link security.** Accept bearer links for the pilot, or require a one-time code to the invited email before starting (stops forwarded links, adds friction and needs D3)?
- **D5. Default retention.** 180 days proposed; some companies will want 30–90. Also: may InterviewAce use anonymised screening transcripts to improve prompts? Recommendation: no, unless the org opts in by contract.
- **D6. Speech providers.** Confirm AssemblyAI and Sarvam retention / training terms and the data region before naming them in the disclosure, or switch to zero-retention settings.
- **D7. Markets.** Pilot limited to India-based hiring, or also EU/US (brings AI Act / NYC LL144 obligations, §11)?
- **D8. Who can create orgs.** Self-serve for any signed-in user, or owner-approved via `SCREENING_ORGS` during the pilot? Recommendation: allow-list.
- **D9. Interview length and question count.** Keep the 3–8 range and ~4 minutes per question, or allow longer screenings (needs `expectedTurn` cap changes in `schemas.js`, `app.js` clarify, `rehearsal.js`)?
- **D10. Candidate-side camera.** Require the camera for screening (needed for `face_absent`), or allow audio-only with that indicator disabled (better for low-bandwidth candidates and some accommodations)?
