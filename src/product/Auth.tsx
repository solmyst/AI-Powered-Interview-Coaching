import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { api } from "./api";
import type { User, Usage } from "./types";
export function Auth({
  done,
  back,
}: {
  done: (user: User, usage: Usage) => void;
  back: () => void;
}) {
  const [register, setRegister] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="auth-layout wrap">
      <section>
        <p className="eyebrow">A LITTLE PRACTICE GOES A LONG WAY</p>
        <h1>
          Make room for
          <br />
          <em>your next move.</em>
        </h1>
        <p className="lead">
          Your interviews, feedback, and progress.
          <br />
          All in one place, ready when you are.
        </p>
        <div className="privacy-note">
          <LockKeyhole size={20} />
          <p>
            Resumes are used to personalize your interview.
            <br />
            You control your saved sessions and account data.
          </p>
        </div>
      </section>
      <form
        className="panel auth-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            const result = await api<{ user: User; usage: Usage }>(
              `/auth/${register ? "register" : "login"}`,
              {
                method: "POST",
                body: JSON.stringify({
                  email: data.get("email"),
                  password: data.get("password"),
                  ...(register ? { name: data.get("name") } : {}),
                }),
              },
            );
            done(result.user, result.usage);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="eyebrow">WELCOME TO INTERVIEWACE</p>
        <h2>{register ? "Create your account" : "Welcome back"}</h2>
        <p>
          {register
            ? "Start with a focused practice session."
            : "Pick up where you left off."}
        </p>
        {register && (
          <label>
            Your name
            <input name="name" autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={10}
            maxLength={128}
          />
          <small>At least 10 characters.</small>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          <ArrowRight size={18} />
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        <button type="button" className="text-button" onClick={back}>
          Back to home
        </button>
        <small>
          Local pilot: email verification and password recovery are not enabled
          yet.
        </small>
      </form>
    </div>
  );
}
