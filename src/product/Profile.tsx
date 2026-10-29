import { useState } from "react";
import { api, download } from "./api";
import type { Health, Usage, User } from "./types";
export function Profile({
  user,
  usage,
  health,
  update,
  logout,
}: {
  user: User;
  usage: Usage;
  health: Health | null;
  update: (u: User) => void;
  logout: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  async function run(work: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await work();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap workspace narrow">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>A space for your progress.</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const result = await api<{ user: User }>("/me", {
              method: "PATCH",
              body: JSON.stringify({ name }),
            });
            update(result.user);
            setNotice("Profile updated.");
          });
        }}
      >
        <h2>Profile</h2>
        <label>
          Name
          <input
            required
            disabled={busy}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        <button className="primary" disabled={busy}>
          Save changes
        </button>
      </form>
      <section className="panel">
        <h2>Practice access</h2>
        <p>
          Free pilot access · {usage.used} of {usage.limit} interviews started
          today. Continuing saved interviews does not use another session.
          Deleting an interview does not restore usage.
        </p>
        <p>
          Billing and paid plans are deferred. No payment details are collected.
        </p>
        <hr />
        <h3>AI connection</h3>
        <p>
          {health?.provider} / {health?.model}
        </p>
        <p>{health?.message}</p>
        <small>
          Provider and model are configured on the server. API keys never belong
          in browser settings.
        </small>
        <h3>Speech connection</h3>
        <p>
          {health?.transcription.provider} / {health?.transcription.model}
        </p>
        <h3>Interviewer voice</h3>
        <p>
          {health?.speech.ready
            ? `${health.speech.provider} / ${health.speech.model}`
            : "Browser voice fallback (Sarvam is not configured)"}
        </p>
      </section>
      <section className="panel">
        <h2>Your data, your choice.</h2>
        <p>
          Interview transcripts and reports are stored in this installation’s
          database. Active sessions also retain resume and job-description text;
          that context is removed when the report is generated. Questions and
          answers may still include personal details.
        </p>
        <p>
          Interview text is processed by the configured AI provider. Spoken
          answers are sent to AssemblyAI for transcription; InterviewAce does
          not save the raw audio. Camera coaching remains on-device.
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () =>
              download("interviewace-data.json", await api("/me/export")),
            )
          }
        >
          Export my data
        </button>
        <hr />
        <h3>Delete account</h3>
        <p>
          Removes your account, interviews, reports, bookmarks, and login
          sessions from the application database. This cannot be undone;
          operator backups may retain copies until their retention period
          expires.
        </p>
        <label>
          Type DELETE to confirm
          <input
            disabled={busy}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="danger"
          disabled={busy || confirm !== "DELETE"}
          onClick={() =>
            run(async () => {
              await api("/me", { method: "DELETE" });
              logout();
            })
          }
        >
          Permanently delete my account
        </button>
      </section>
    </div>
  );
}
