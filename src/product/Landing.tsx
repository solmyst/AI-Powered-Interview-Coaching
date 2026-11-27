import {
  ArrowUpRight,
  AudioLines,
  Brain,
  Briefcase,
  Check,
  ClipboardCheck,
  CornerDownRight,
  ListChecks,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
export function Landing({
  start,
  hire,
}: {
  start: () => void;
  hire: () => void;
}) {
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="dot" /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            Great interviews
            <br />
            aren’t improvised.
            <br />
            <em>They’re practiced.</em>
          </h1>
          <p className="lead">
            Turn what you know into answers that land.
            <br className="desktop" /> Practice with an AI interviewer that
            listens, digs deeper,
            <br className="desktop" /> and helps you get better, one
            conversation at a time.
          </p>
          <button className="primary large" onClick={start}>
            Start your first interview <ArrowUpRight size={20} />
          </button>
          <div className="hero-notes">
            <span>
              <Check size={15} /> Free practice access
            </span>
            <span>
              <Check size={15} /> Voice-first video practice
            </span>
          </div>
        </div>
        <div className="preview">
          <div className="preview-top">
            <span className="mini-brand">
              <Brain size={18} /> INTERVIEWACE
            </span>
            <span className="pill">Sample conversation</span>
          </div>
          <div className="preview-context">
            <span>BACKEND ENGINEERING</span>
            <span>02 / 05</span>
          </div>
          <div className="wave-art" aria-hidden="true">
            {[
              20, 32, 18, 46, 70, 40, 90, 120, 76, 48, 82, 106, 62, 38, 68, 94,
              54, 30, 50, 24, 36, 16,
            ].map((h, i) => (
              <i key={i} style={{ height: h }} />
            ))}
          </div>
          <p className="speaker">THE INTERVIEWER</p>
          <h2>
            “You mentioned caching.
            <br />
            What happens when the
            <br />
            underlying data changes?”
          </h2>
          <div className="preview-answer">
            <CornerDownRight size={18} />
            <p>
              A follow-up shaped by your answer.
              <br />
              <strong>Because the details make the difference.</strong>
            </p>
          </div>
          <div className="preview-bottom">
            <span>
              <span className="dot" /> One question. Your pace.
            </span>
            <AudioLines size={22} />
          </div>
        </div>
      </section>
      <section className="track-strip">
        <div className="wrap">
          <span>PREPARE FOR YOUR PATH</span>
          <p>
            Engineering <b>·</b> Data & AI <b>·</b> Product <b>·</b> Behavioral{" "}
            <b>·</b> System design
          </p>
        </div>
      </section>
      <section className="wrap process" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DELIBERATE PRACTICE. REAL PROGRESS.</p>
            <h2>
              Close the gap between
              <br />
              knowing and explaining.
            </h2>
          </div>
          <p>
            No scripts to memorize. A focused loop
            <br />
            of practice, reflection, and improvement.
          </p>
        </div>
        <div className="three-col">
          {[
            [
              MessageSquare,
              "01",
              "Make it your interview",
              "Choose a role, round, and difficulty. Add your resume or a job description to make the conversation relevant.",
            ],
            [
              AudioLines,
              "02",
              "Think out loud",
              "Answer naturally in a voice-first video call. Expect follow-ups that challenge your reasoning, not random trivia.",
            ],
            [
              ShieldCheck,
              "03",
              "Know what to work on",
              "Review evidence-based feedback, example answers, and a study plan. Save questions and track your practice over time.",
            ],
          ].map(([Icon, n, title, desc]) => {
            const I = Icon as typeof Brain;
            return (
              <article className="process-item" key={String(n)}>
                <div>
                  <I size={24} />
                  <span>{String(n)}</span>
                </div>
                <h3>{String(title)}</h3>
                <p>{String(desc)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="wrap process hiring-teams" id="hiring">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FOR HIRING TEAMS</p>
            <h2>
              Shortlist with evidence,
              <br />
              not guesswork.
            </h2>
          </div>
          <p>
            Send one link. Maya runs a structured first-round interview, scores
            each answer against your criteria with quotes from what the
            candidate said, and gives your team a ranked shortlist. A person on
            your team makes every decision.
          </p>
        </div>
        <div className="three-col">
          {[
            [
              ClipboardCheck,
              "01",
              "Set up a role in minutes",
              "Paste the job description, add your own questions if you like, and choose the criteria and their weights. Maya asks your questions first, then follows up on what each candidate says.",
            ],
            [
              Briefcase,
              "02",
              "Candidates interview on their own time",
              "Each candidate gets a private link with no sign-up. They answer by voice or typing, in English or Hindi, and can resume if the connection drops. Full-screen proctoring is on by default.",
            ],
            [
              ListChecks,
              "03",
              "Review a ranked shortlist",
              "See scores per criterion with the quotes behind them, the full transcript, focus notes and questions for your own round. Advance, hold or reject, and export the list.",
            ],
          ].map(([Icon, n, title, desc]) => {
            const I = Icon as typeof Brain;
            return (
              <article className="process-item" key={String(n)}>
                <div>
                  <I size={24} />
                  <span>{String(n)}</span>
                </div>
                <h3>{String(title)}</h3>
                <p>{String(desc)}</p>
              </article>
            );
          })}
        </div>
        <div className="hiring-cta">
          <button className="primary large" onClick={hire}>
            Start hiring with InterviewAce <ArrowUpRight size={20} />
          </button>
          <div className="hero-notes">
            <span>
              <Check size={15} /> Early access: our team approves company
              accounts
            </span>
            <span>
              <Check size={15} /> No video is recorded
            </span>
          </div>
        </div>
      </section>
      <section className="wrap">
        <div className="closing">
          <div>
            <p className="eyebrow">LESS GUESSWORK. MORE PREPARATION.</p>
            <h2>
              Your next interview
              <br />
              deserves a rehearsal.
            </h2>
          </div>
          <button className="primary large" onClick={start}>
            Find your starting point <ArrowUpRight size={20} />
          </button>
        </div>
      </section>
      <footer className="wrap footer">
        <strong>InterviewAce</strong>
        <p>AI scores support people. They never make the hiring decision.</p>
        <span>Built for the next step.</span>
      </footer>
    </>
  );
}
