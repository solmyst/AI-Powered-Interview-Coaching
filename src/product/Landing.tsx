import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Brain,
  Briefcase,
  Check,
  ChevronRight,
  FileText,
  Mic,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/aceternity/reveal";
import { appPath, homePath } from "../lib/paths";

const previews = [
  {
    name: "Behavioral",
    question:
      "Tell me about a time you had to make a decision with incomplete information.",
    focus: "Decision-making",
    followup: "What did you do to reduce the uncertainty?",
    checkpoint: "Explain the trade-off behind your decision.",
  },
  {
    name: "Technical",
    question:
      "Your API slows down under peak traffic. How would you find the bottleneck?",
    focus: "Problem solving",
    followup: "What would you measure before changing the architecture?",
    checkpoint: "Connect your proposed fix to a measured bottleneck.",
  },
  {
    name: "System design",
    question:
      "How would you design a notification service that handles sudden traffic spikes?",
    focus: "Architecture & trade-offs",
    followup: "What happens if the downstream provider becomes unavailable?",
    checkpoint: "Describe the failure path, not just the happy path.",
  },
];
export function Landing({
  start,
  hire,
}: {
  start: () => void;
  hire: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const preview = previews[selected];
  return (
    <>
      <section className="landing-intro">
        <div className="wrap">
          <Reveal className="landing-heading">
            <p className="landing-eyebrow">
              <span /> YOUR NEXT INTERVIEW STARTS HERE
            </p>
            <h1>
              Great interviews.
              <br />
              <span>Built through practice.</span>
            </h1>
            <p>
              Find your words before the real conversation.
              <br className="landing-desktop-break" /> Practice with Maya, get
              specific feedback, and come back sharper.
            </p>
            <div className="landing-hero-actions">
              <Button size="lg" onClick={start}>
                Start your first interview <ArrowUpRight size={18} />
              </Button>
              <a href="#experience">
                Explore the experience <ArrowRight size={16} />
              </a>
            </div>
            <div className="landing-assurances">
              <span>
                <Check size={14} />
                English & Hindi
              </span>
              <span>
                <Check size={14} />
                Resume-aware questions
              </span>
              <span>
                <Check size={14} />
                Your pace
              </span>
            </div>
          </Reveal>
          <div className="landing-workbench" id="experience">
            <div className="landing-demo-toolbar">
              <span>
                <span className="landing-status-dot" /> EXPLORE A PRACTICE ROUND
              </span>
              <span>Interactive preview · not a live call</span>
            </div>
            <div className="landing-demo-grid">
              <div className="landing-demo-question">
                <div
                  className="landing-rounds"
                  aria-label="Choose a preview round"
                >
                  {previews.map((item, i) => (
                    <button
                      key={item.name}
                      aria-pressed={selected === i}
                      onClick={() => setSelected(i)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="landing-question-content" aria-live="polite">
                  <span className="landing-question-meta">
                    01 / A QUESTION TO THINK ABOUT
                  </span>
                  <h2>{preview.question}</h2>
                  <span className="landing-focus">
                    <FileText size={13} />
                    {preview.focus}
                  </span>
                </div>
                <div className="landing-demo-footer">
                  <Mic size={15} />
                  In the interview, you answer aloud.
                </div>
              </div>
              <div className="landing-maya-panel">
                <div className="landing-maya-orbit">
                  <div>
                    <Brain size={44} />
                  </div>
                </div>
                <strong>Maya</strong>
                <span>Your AI interview coach</span>
                <div className="landing-wave" aria-hidden="true">
                  {[12, 22, 34, 18, 44, 27, 48, 21, 32, 15, 26, 10].map(
                    (height, i) => (
                      <i key={i} style={{ height }} />
                    ),
                  )}
                </div>
                <p>
                  A conversation that follows
                  <br />
                  your thinking.
                </p>
              </div>
              <div className="landing-feedback-panel" aria-live="polite">
                <span className="landing-preview-label">
                  THEN GO ONE LEVEL DEEPER
                </span>
                <div className="landing-followup">
                  <AudioLines size={19} />
                  <p>{preview.followup}</p>
                </div>
                <div className="landing-feedback-divider" />
                <span className="landing-preview-label">
                  TURN FEEDBACK INTO PRACTICE
                </span>
                <div className="landing-checkpoint">
                  <span>
                    <Check size={14} />
                  </span>
                  <p>{preview.checkpoint}</p>
                </div>
                <small>
                  Illustrative content. Nothing is recorded in this preview.
                </small>
              </div>
            </div>
          </div>
          <div className="landing-intro-foot">
            <span>TECHNICAL</span>
            <i />
            <span>BEHAVIORAL</span>
            <i />
            <span>SYSTEM DESIGN</span>
            <i />
            <span>PRODUCT & MORE</span>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="landing-process wrap">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">LESS GUESSWORK. MORE PREPARATION.</p>
          <h2>
            One conversation.
            <br />A clearer next step.
          </h2>
          <p>
            You bring the experience. We give you a place to practise explaining
            it.
          </p>
        </div>
        <div className="landing-process-grid">
          {[
            {
              n: "01",
              icon: FileText,
              title: "Set the scene",
              text: "Choose a role and round. Add your resume or a job description to make the interview yours.",
            },
            {
              n: "02",
              icon: Mic,
              title: "Say it out loud",
              text: "Check your devices, meet Maya, and work through questions with follow-ups. Pause or clarify anytime.",
            },
            {
              n: "03",
              icon: Sparkles,
              title: "Make the next answer better",
              text: "See where your explanation worked, what was missing, and what to practise next.",
            },
          ].map(({ n, icon: Icon, title, text }) => (
            <article key={n}>
              <div>
                <span>{n}</span>
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-lab wrap">
        <div className="landing-lab-copy">
          <p className="landing-eyebrow">
            <Sparkles size={14} /> MORE THAN A SCORE
          </p>
          <h2>
            Feedback is useful.
            <br />
            <em>Putting it to work is better.</em>
          </h2>
          <p>
            Answer Lab takes one answer from your report and gives you a focused
            way to improve it. Retry aloud. Then apply what you learned to a
            different scenario.
          </p>
          <Button variant="outline" onClick={start}>
            Find your next breakthrough <ArrowUpRight size={16} />
          </Button>
        </div>
        <Card className="landing-lab-card">
          <div className="landing-lab-card-top">
            <span>
              <Sparkles size={16} /> ANSWER LAB
            </span>
            <span>Example practice plan</span>
          </div>
          <h3>Make your reasoning visible.</h3>
          <p>Three checkpoints. One focused retry.</p>
          <ol>
            {[
              "Explain the decision you made",
              "Name the trade-off you considered",
              "Show what changed as a result",
            ].map((text, i) => (
              <li key={text}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {text}
                <Check size={15} />
              </li>
            ))}
          </ol>
          <div className="landing-lab-path">
            <span>Original answer</span>
            <ChevronRight size={14} />
            <strong>Spoken retry</strong>
            <ChevronRight size={14} />
            <span>New scenario</span>
          </div>
        </Card>
      </section>
      <section className="landing-hiring wrap" id="hiring">
        <div className="landing-hiring-inner">
          <div>
            <p className="landing-eyebrow">
              <Briefcase size={14} /> FOR HIRING TEAMS
            </p>
            <h2>
              A first round.
              <br />
              Built around your role.
            </h2>
            <p>
              Create structured interviews, share private candidate links, and
              review the evidence in a dedicated hiring workspace.
            </p>
            <Button size="lg" onClick={hire}>
              Start hiring with InterviewAce <ArrowUpRight size={18} />
            </Button>
            <small>
              Early access for company accounts. Your team makes every decision.
            </small>
          </div>
          <div className="landing-hiring-list">
            {[
              {
                icon: Briefcase,
                title: "Your role. Your criteria.",
                text: "Define what matters with your job description, questions, and rubric.",
              },
              {
                icon: FileText,
                title: "The evidence, in one place.",
                text: "Read transcripts, quoted evidence, and reviewer notes.",
              },
              {
                icon: ShieldCheck,
                title: "A human decision, always.",
                text: "Use the report to guide the next conversation.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="landing-faq wrap">
        <div>
          <p className="landing-eyebrow">A FEW GOOD QUESTIONS</p>
          <h2>
            Before you
            <br />
            take a seat.
          </h2>
        </div>
        <div>
          {[
            [
              "How does the interview work?",
              "Choose your role, check your camera and microphone, and join. Maya speaks the questions and listens to your answers. You can pause, repeat, or clarify a question.",
            ],
            [
              "Is my camera video recorded?",
              "No. Camera analysis runs on your device. Transcripts and aggregate coaching measurements can be saved with your report.",
            ],
            [
              "What do the scores mean?",
              "They are AI coaching estimates, not a hiring decision. Use the feedback and transcript to understand your explanation. Hiring teams make their own decisions.",
            ],
            [
              "Are practice and hiring separate?",
              "Yes. Personal preparation lives in the practice workspace. Company roles, candidates, and reviewer settings live in the hiring workspace.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="landing-final wrap">
        <p>Your next conversation deserves a little practice.</p>
        <Button size="lg" onClick={start}>
          Take your first practice round <ArrowUpRight size={18} />
        </Button>
      </section>
      <footer className="landing-footer">
        <div className="wrap">
          <a className="brand" href={homePath()}>
            <Brain size={21} />
            InterviewAce.
          </a>
          <p>Ready for what’s next.</p>
          <a href={appPath("practice")}>Interview practice</a>
          <a href={appPath("hiring")}>Hiring workspace</a>
        </div>
      </footer>
    </>
  );
}
