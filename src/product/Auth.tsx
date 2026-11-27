import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { api } from "./api";
import type { User, Usage } from "./types";
export function Auth({
  done,
  back,
  initialRegister = true,
  hiring = false,
}: {
  done: (user: User, usage: Usage) => void;
  back: () => void;
  initialRegister?: boolean;
  hiring?: boolean;
}) {
  const [register, setRegister] = useState(initialRegister);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="auth-layout wrap">
      {hiring ? (
        <section>
          <p className="eyebrow">FOR HIRING TEAMS</p>
          <h1>
            Your first round,
            <br />
            <em>handled.</em>
          </h1>
          <p className="lead">
            Create your account, then set up your company and your first role.
            <br />
            Company accounts are in early access: if yours is new, request
            access and our team will turn it on.
          </p>
          <div className="privacy-note">
            <LockKeyhole size={20} />
            <p>
              No video is recorded. Candidates see a plain notice and agree
              before they start.
              <br />A person on your team makes every decision.
            </p>
          </div>
        </section>
      ) : (
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
      )}
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
            ? hiring
              ? "Use your work email. You'll set up your company next."
              : "Start with a focused practice session."
            : hiring
              ? "Sign in to open your hiring workspace."
              : "Pick up where you left off."}
        </p>
        {register && (
          <label>
            Your name
            <input
              name="name"
              disabled={busy}
              autoComplete="name"
              required
              maxLength={80}
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            disabled={busy}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <div className="password-group">
          <label htmlFor="account-password">Password</label>
          <span className="password-field">
            <input
              id="account-password"
              name="password"
              disabled={busy}
              type={showPassword ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={10}
              maxLength={128}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          <small>At least 10 characters.</small>
        </div>
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
            setShowPassword(false);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-button"
          onClick={back}
        >
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
