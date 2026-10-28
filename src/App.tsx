import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  ArrowUpRight,
  LayoutDashboard,
  BookOpen,
  History,
  UserRound,
  LogOut,
} from "lucide-react";
import { api } from "./product/api";
import { Landing } from "./product/Landing";
import { Auth } from "./product/Auth";
import { Setup } from "./product/Setup";
import { Dashboard, SessionList } from "./product/Dashboard";
import { Room } from "./product/Room";
import { Report } from "./product/Report";
import { Profile } from "./product/Profile";
import type {
  User,
  Usage,
  Health,
  Session,
  Summary,
  Bookmark,
  Page,
} from "./product/types";
import "./product/product.css";
function App() {
  const [page, setPage] = useState<Page>("home");
  const [auth, setAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage>({
    used: 0,
    limit: 5,
    reset: "00:00 UTC",
  });
  const [health, setHealth] = useState<Health | null>(null);
  const [sessions, setSessions] = useState<Summary[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const refreshHealth = useCallback(() => {
    void api<Health>("/health")
      .then(setHealth)
      .catch(() =>
        setHealth({
          ready: false,
          provider: "Unavailable",
          model: "",
          message: "The API server is offline.",
          transcription: {
            ready: false,
            provider: "assemblyai",
            model: "universal-3-5-pro",
          },
          speech: {
            ready: false,
            provider: "elevenlabs",
            model: "eleven_v4_turbo",
            voiceId: "",
          },
        }),
      );
  }, []);
  const refresh = useCallback(async () => {
    const [history, saved] = await Promise.all([
      api<{ sessions: Summary[]; usage: Usage }>("/interviews"),
      api<Bookmark[]>("/bookmarks"),
    ]);
    setSessions(history.sessions);
    setUsage(history.usage);
    setBookmarks(saved);
  }, []);
  useEffect(() => {
    refreshHealth();
    void api<{ user: User | null; usage: Usage | null }>("/auth/session")
      .then((result) => {
        if (result.user && result.usage) {
          setUser(result.user);
          setUsage(result.usage);
          setPage("dashboard");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Remove old client-stored API configuration from previous prototype installations.
    localStorage.removeItem("interview_ace_ai_config");
  }, [refreshHealth]);
  useEffect(() => {
    if (user) void refresh().catch((err) => setError(err.message));
  }, [user, refresh]);
  function navigate(next: Page) {
    setPage(next);
    setError("");
    window.scrollTo({ top: 0 });
  }
  function opened(s: Session) {
    setSession(s);
    navigate(s.state === "complete" ? "report" : "room");
  }
  async function open(id: string) {
    setError("");
    try {
      opened(await api<Session>(`/interviews/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function toggle(id: string, turn: number, saved: boolean) {
    try {
      await api(`/interviews/${id}/bookmarks`, {
        method: "POST",
        body: JSON.stringify({ turn, saved }),
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setSession(null);
      setSessions([]);
      setBookmarks([]);
      navigate("home");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const start = () => {
    if (user) navigate("setup");
    else setAuth(true);
  };
  if (loading)
    return (
      <main className="loading-screen" aria-busy="true">
        <Brain size={32} />
        <p>Opening your practice space…</p>
      </main>
    );
  const nav = [
    ["dashboard", LayoutDashboard, "Overview"],
    ["history", History, "My interviews"],
    ["library", BookOpen, "Revision library"],
    ["profile", UserRound, "Profile"],
  ] as const;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {page !== "room" && <header className="site-header">
        <div className="wrap header-inner">
          <button
            className="brand"
            onClick={() => {
              setAuth(false);
              navigate(user ? "dashboard" : "home");
            }}
            aria-label="InterviewAce home"
          >
            <span>
              <Brain size={23} />
            </span>
            InterviewAce<span className="brand-period">.</span>
          </button>
          {user ? (
            <>
              <nav aria-label="Main navigation">
                {nav.map(([p, Icon, label]) => (
                  <button
                    key={p}
                    className={page === p ? "active" : ""}
                    onClick={() => navigate(p)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
              <button
                className="icon-button"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut size={19} />
              </button>
            </>
          ) : (
            <nav>
              <a
                className="how-link"
                href="#how-it-works"
                onClick={() => setAuth(false)}
              >
                How it works
              </a>
              <button className="primary small" onClick={start}>
                Start practicing <ArrowUpRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </header>}
      <main id="main">
        {error && (
          <div className="wrap error" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                void refresh().catch((err) => setError(err.message));
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!user ? (
          auth ? (
            <Auth
              back={() => setAuth(false)}
              done={(u, used) => {
                setUser(u);
                setUsage(used);
                setAuth(false);
                navigate("dashboard");
              }}
            />
          ) : (
            <Landing start={start} />
          )
        ) : (
          <>
            {page === "dashboard" && (
              <Dashboard
                user={user}
                usage={usage}
                sessions={sessions}
                start={start}
                open={open}
                history={() => navigate("history")}
              />
            )}
            {page === "setup" && (
              <Setup
                health={health}
                usage={usage}
                open={opened}
                refresh={() => {
                  refreshHealth();
                  void refresh().catch((err) => setError(err.message));
                }}
              />
            )}
            {page === "room" && session && (
              <Room
                key={session.id}
                session={session}
                transcriptionReady={Boolean(health?.transcription.ready)}
                speechReady={Boolean(health?.speech.ready)}
                update={(s) => {
                  opened(s);
                  void refresh().catch((err) => setError(err.message));
                }}
                back={() => navigate("dashboard")}
              />
            )}
            {page === "report" && session?.report && (
              <Report
                session={session}
                update={setSession}
                speechReady={Boolean(health?.speech.ready)}
                transcriptionReady={Boolean(health?.transcription.ready)}
                bookmarks={bookmarks}
                toggle={toggle}
                start={start}
              />
            )}
            {page === "history" && (
              <div className="wrap workspace">
                <p className="eyebrow">EVERY SESSION IS A STEP</p>
                <div className="room-heading">
                  <h1>Your interview history.</h1>
                  <button className="primary" onClick={start}>
                    New interview <ArrowUpRight size={18} />
                  </button>
                </div>
                <label className="filter-label">
                  Show
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option>All</option>
                    <option>Complete</option>
                    <option>In progress</option>
                  </select>
                </label>
                {deleteId && (
                  <section className="notice" role="alert">
                    <p>
                      Delete this interview and its bookmarks permanently? Daily
                      usage will not be restored.
                    </p>
                    <button
                      className="danger"
                      onClick={async () => {
                        try {
                          await api(`/interviews/${deleteId}`, {
                            method: "DELETE",
                          });
                          setDeleteId(null);
                          await refresh();
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      Delete interview
                    </button>{" "}
                    <button
                      className="secondary"
                      onClick={() => setDeleteId(null)}
                    >
                      Keep interview
                    </button>
                  </section>
                )}
                <section className="panel">
                  <SessionList
                    sessions={sessions.filter(
                      (s) =>
                        filter === "All" ||
                        (filter === "Complete"
                          ? s.state === "complete"
                          : s.state !== "complete"),
                    )}
                    open={open}
                    remove={setDeleteId}
                  />
                </section>
                <small>Showing the latest 100 interviews.</small>
              </div>
            )}
            {page === "library" && (
              <div className="wrap workspace">
                <p className="eyebrow">KEEP THE LESSONS CLOSE</p>
                <h1>Your revision library.</h1>
                <p className="lead">
                  Saved questions, example answers, and concepts to revisit.
                </p>
                {!bookmarks.length ? (
                  <section className="panel empty">
                    <BookOpen size={32} />
                    <h2>A place for your “try that again” moments.</h2>
                    <p>
                      Save questions from any completed report. They’ll be ready
                      here when you want another look.
                    </p>
                    <button className="primary" onClick={start}>
                      Start a practice session
                    </button>
                  </section>
                ) : (
                  bookmarks.map((b) => (
                    <details
                      className="panel"
                      key={`${b.interviewId}-${b.turn}`}
                    >
                      <summary>{b.question.question}</summary>
                      <h3>Revision notes</h3>
                      <p>{b.evaluation.rationale}</p>
                      <p>Focus: {b.evaluation.improvements.join(" ")}</p>
                      <details>
                        <summary>Reveal example answer</summary>
                        <p className="prewrap">{b.evaluation.modelAnswer}</p>
                      </details>
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() => open(b.interviewId)}
                        >
                          View full report
                        </button>
                        <button
                          className="text-button"
                          onClick={() => toggle(b.interviewId, b.turn, false)}
                        >
                          Remove bookmark
                        </button>
                      </div>
                    </details>
                  ))
                )}
              </div>
            )}
            {page === "profile" && (
              <Profile
                user={user}
                usage={usage}
                health={health}
                update={setUser}
                logout={() => {
                  setUser(null);
                  setSession(null);
                  setSessions([]);
                  setBookmarks([]);
                  navigate("home");
                }}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
export default App;
