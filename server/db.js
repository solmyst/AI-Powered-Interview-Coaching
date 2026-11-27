import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS interviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS interviews_owner ON interviews(user_id, created);
    CREATE TABLE IF NOT EXISTS usage (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, day));
    CREATE TABLE IF NOT EXISTS bookmarks (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE, turn INTEGER NOT NULL, PRIMARY KEY(user_id, interview_id, turn));
  `);
  // Version 2 counts paid speech-to-text and text-to-speech calls per day.
  if (db.pragma("user_version", { simple: true }) < 2)
    db.transaction(() => {
      db.exec(
        "ALTER TABLE usage ADD COLUMN speech_calls INTEGER NOT NULL DEFAULT 0",
      );
      db.pragma("user_version = 2");
    })();
  // Version 3 adds company screening. All new tables: existing practice data is never rebuilt.
  if (db.pragma("user_version", { simple: true }) < 3)
    db.transaction(() => {
      db.exec(`
        CREATE TABLE orgs (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_email TEXT NOT NULL DEFAULT '', retention_days INTEGER NOT NULL DEFAULT 180 CHECK (retention_days BETWEEN 30 AND 730), created TEXT NOT NULL);
        CREATE TABLE org_members (org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK (role IN ('owner','reviewer')), created TEXT NOT NULL, PRIMARY KEY (org_id, user_id));
        CREATE INDEX org_members_user ON org_members(user_id);
        CREATE TABLE roles (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','open','closed')), config TEXT NOT NULL, created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created TEXT NOT NULL);
        CREATE INDEX roles_org ON roles(org_id, created);
        CREATE TABLE invites (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, candidate_name TEXT NOT NULL, candidate_email TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending','started','completed','expired','revoked','withdrawn')), expires INTEGER NOT NULL, consent TEXT, decision TEXT, candidate_note TEXT, speech_calls INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, UNIQUE (role_id, candidate_email));
        CREATE INDEX invites_role ON invites(role_id, status);
        CREATE TABLE candidate_sessions (token TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        CREATE TABLE screenings (id TEXT PRIMARY KEY, invite_id TEXT UNIQUE NOT NULL REFERENCES invites(id) ON DELETE CASCADE, created TEXT NOT NULL, state TEXT NOT NULL, score INTEGER, data TEXT NOT NULL);
        CREATE TABLE integrity_events (id INTEGER PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE, at TEXT NOT NULL, turn INTEGER NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('tab_hidden','fullscreen_exit','face_absent','multiple_faces','camera_off','paste','reconnect','new_device')), duration_ms INTEGER, reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL, reviewed_at TEXT, verdict TEXT CHECK (verdict IN ('no_concern','concern')), review_note TEXT);
        CREATE INDEX integrity_invite ON integrity_events(invite_id, at);
        CREATE TABLE org_usage (org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE, day TEXT NOT NULL, screenings INTEGER NOT NULL DEFAULT 0, speech_calls INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (org_id, day));
      `);
      db.pragma("user_version = 3");
    })();
  // Version 4: per-candidate résumé and interview window, and strict-proctoring event kinds.
  // integrity_events is rebuilt because SQLite cannot change a CHECK; nothing references it.
  if (db.pragma("user_version", { simple: true }) < 4)
    db.transaction(() => {
      db.exec(`
        ALTER TABLE invites ADD COLUMN resume TEXT NOT NULL DEFAULT '';
        ALTER TABLE invites ADD COLUMN starts INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE integrity_events_v4 (id INTEGER PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE, at TEXT NOT NULL, turn INTEGER NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('tab_hidden','fullscreen_exit','face_absent','multiple_faces','camera_off','paste','multiple_screens','terminated','reconnect','new_device')), duration_ms INTEGER, reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL, reviewed_at TEXT, verdict TEXT CHECK (verdict IN ('no_concern','concern')), review_note TEXT);
        INSERT INTO integrity_events_v4 SELECT id, invite_id, at, turn, kind, duration_ms, reviewed_by, reviewed_at, verdict, review_note FROM integrity_events;
        DROP TABLE integrity_events;
        ALTER TABLE integrity_events_v4 RENAME TO integrity_events;
        CREATE INDEX integrity_invite ON integrity_events(invite_id, at);
      `);
      db.pragma("user_version = 4");
    })();
  // Version 5: early-access requests for company accounts. Approval is SCREENING_EMAILS on the server.
  if (db.pragma("user_version", { simple: true }) < 5)
    db.transaction(() => {
      db.exec(
        "CREATE TABLE hiring_requests (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, company TEXT NOT NULL, team_size TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created TEXT NOT NULL)",
      );
      db.pragma("user_version = 5");
    })();
  // Version 6: privileged accounts are pinned to user ids, not matched by email at request time, so
  // registering an allow-listed email that no one has used yet grants nothing.
  if (db.pragma("user_version", { simple: true }) < 6)
    db.transaction(() => {
      db.exec(
        "CREATE TABLE approved_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('unlimited','screening')), email TEXT NOT NULL, created TEXT NOT NULL)",
      );
      db.pragma("user_version = 6");
    })();
  // Version 7: a shareable open link per role. Candidates open it, enter name and email, and get their own
  // private invite. The token is kept (not hashed) so the owner can copy the link again.
  if (db.pragma("user_version", { simple: true }) < 7)
    db.transaction(() => {
      db.exec(
        "CREATE TABLE role_open_links (role_id TEXT PRIMARY KEY REFERENCES roles(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1, cap INTEGER NOT NULL DEFAULT 50, used INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL); ALTER TABLE invites ADD COLUMN via_open_link INTEGER NOT NULL DEFAULT 0;",
      );
      db.pragma("user_version = 7");
    })();
  // Version 8: when a candidate was last active, and when they stepped away on purpose, so the company can
  // tell "answering now" from "left before finishing".
  if (db.pragma("user_version", { simple: true }) < 8)
    db.transaction(() => {
      db.exec(
        "ALTER TABLE invites ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0; ALTER TABLE invites ADD COLUMN left_at INTEGER NOT NULL DEFAULT 0;",
      );
      db.pragma("user_version = 8");
    })();
  return db;
}
