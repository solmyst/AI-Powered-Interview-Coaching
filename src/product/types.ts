import type { VisualSummary } from "./vision/metrics";
export type Delivery = {
  visual?: VisualSummary;
  speech?: {
    source: "assemblyai";
    captureMs: number;
    words: number;
    fillers: number;
  };
  selfConfidence?: number;
};
export type User = { id: string; name: string; email: string };
export type Usage = { used: number; limit: number; reset: string };
export type Health = {
  ready: boolean;
  provider: string;
  model: string;
  message: string;
  transcription: {
    ready: boolean;
    provider: string;
    model: string;
  };
  speech: {
    ready: boolean;
    provider: string;
    model: string;
    voiceId: string;
  };
};
export const roles = [
  "Software engineering",
  "Frontend",
  "Backend",
  "Full-stack",
  "Data science",
  "AI / ML",
  "DevOps",
  "Cybersecurity",
  "Product management",
  "HR",
];
export const tracks = [
  "Technical",
  "Coding",
  "System design",
  "Behavioral",
  "Product sense",
  "Aptitude",
];
export type Setup = {
  role: string;
  experience: string;
  track: string;
  difficulty: string;
  industry: string;
  company: string;
  resume: string;
  jobDescription: string;
  questionCount: number;
};
export type Question = { question: string; focus: string; difficulty: string };
export type Evaluation = {
  scores: Record<string, number>;
  rationale: string;
  strengths: string[];
  improvements: string[];
  missingConcepts: string[];
  modelAnswer: string;
};
export type Turn = {
  question: Question;
  answer: string;
  evaluation: Evaluation;
  delivery?: Delivery;
};
export type Report = {
  summary: string;
  scores: Record<string, number>;
  overall: number;
  answered: number;
  strengths: string[];
  improvements: string[];
  studyPlan: {
    day: number;
    topic: string;
    task: string;
    practiceQuestion: string;
  }[];
};
export type Session = {
  rehearsals?: Record<string, Rehearsal>;
  id: string;
  created: string;
  state: "active" | "report_pending" | "complete";
  setup: Setup;
  currentQuestion: Question | null;
  turns: Turn[];
  report: Report | null;
  model: string;
  provider: string;
};
export type Observation = {
  status: "demonstrated" | "partial" | "not_yet";
  evidence: string | null;
  reason: string;
};
export type Rehearsal = {
  plan: {
    focus: string;
    coaching: string;
    checkpoints: { criterion: string; baseline: Observation }[];
    transferQuestion: string;
  };
  attempts: {
    stage: "retry" | "transfer";
    question: string;
    answer: string;
    result: { summary: string; checks: Observation[]; nextStep: string };
  }[];
};
export type Summary = {
  id: string;
  created: string;
  state: Session["state"];
  role: string;
  track: string;
  answered: number;
  total: number;
  score: number | null;
};
export type Bookmark = Turn & { interviewId: string; turn: number };
export type Page =
  | "home"
  | "dashboard"
  | "setup"
  | "room"
  | "report"
  | "history"
  | "library"
  | "profile";
