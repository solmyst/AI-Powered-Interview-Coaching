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
  return db;
}
