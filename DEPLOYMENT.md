# Deployment

For the concrete Azure GPU/CPU VM procedure, systemd unit and Nginx configuration, see [docs/AZURE-VM.md](docs/AZURE-VM.md) and `deploy/`.

## Topology

Run one Node API process with persistent SQLite disk behind an HTTPS reverse proxy. The API also serves the built React files, so browser requests stay on one origin. Run Ollama on the same trusted host/network, or configure NVIDIA. Do not expose Ollama to the public internet. Static GitHub Pages cannot host this application's authenticated API.

## Build and start

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
# Set these in your hosting platform or process supervisor:
# NODE_ENV=production
# APP_ORIGIN=https://your-domain.example
# DATABASE_PATH=/persistent/interviewace.db
# HOST=127.0.0.1 (same-host reverse proxy) or 0.0.0.0 (isolated container)
npm start
```

`APP_ORIGIN` must be an exact HTTPS origin without a trailing slash. Production startup rejects HTTP origins. Cookies are Secure, HttpOnly and SameSite=Strict. Restrict write access to `.env` and the database directory; SQLite does not itself encrypt personal data. Use encrypted disks and encrypted backups. Do not put the database inside an ephemeral application image or use several independent replicas.

Terminate TLS at a trusted proxy, forwarding requests to port 3001, and allow a response timeout of at least 250 seconds for local model work and one transient retry. Keep the API port private. The app does not blindly trust `X-Forwarded-For`: default IP limits aggregate behind a proxy. Configure verified proxy topology and per-user/shared-store limits before a larger public launch rather than turning on unrestricted trust proxy.

Configure health probes against `/api/health`. For Ollama, `ready` checks the installed model list, not generation quality. For NVIDIA it checks configuration, not account authorization or credits. Run an actual test interview after every provider/model change.

## Storage and recovery

Schema version 1 is initialized automatically on first startup. Future schema changes must have explicit numbered migrations and backup/restore validation before release. WAL is enabled. Do not copy only the main `.db` file while a live writer is active. Use SQLite's online backup API or stop the service before backing up the full database. Retain backups for a documented period and verify restore on a separate installation. Account deletion cascades through active application tables; historical backups require their own retention/deletion policy.

The only process-local state is concurrency/rate-limit state. Interview data, login sessions, bookmarks and daily usage survive restarts. Restarting during model generation abandons that call; the candidate can reload and retry from the last committed answer. A successfully generated but unsaved provider response may consume provider compute without a recorded token counter.

## Production smoke check

1. Verify HTTPS, correct origin, Secure cookies and no browser secrets.
2. Register/sign in; deny cross-origin mutations and anonymous/other-account access.
3. Start a three-question session, reload/resume, submit all answers and generate the report.
4. Save a bookmark, open the library, export data, delete the test session/account.
5. Test the daily cap; deletion must not refund usage. Stop the AI provider and verify recoverable errors.
6. Confirm camera and microphone permissions are requested in preflight, the camera preview appears before Join, the same devices remain active in the call, questions play automatically, a spoken answer advances after silence, and the Done speaking fallback works in a noisy room.
7. Run a small concurrent load test and observe timeouts, memory and provider cost.

## Public launch gates

Before collecting real student data at scale: verified-email/recovery flows, account-abuse controls, privacy/retention policy, encrypted backups, restore drills, provider data-processing review, load tests and observability alerts. Benchmark the selected model with expert-graded answers across each advertised track, and remove unsupported tracks if evaluation quality is inadequate. No live deployment or domain change was performed in this task.
