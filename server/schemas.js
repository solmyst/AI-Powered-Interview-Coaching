import { z } from "zod";
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
export const setupSchema = z
  .object({
    role: z.enum(roles),
    experience: z.enum([
      "Student / graduate",
      "Early career",
      "Experienced",
      "Senior / lead",
    ]),
    track: z.enum(tracks),
    difficulty: z.enum(["Foundational", "Intermediate", "Advanced"]),
    industry: z.string().trim().min(1).max(80),
    company: z.string().trim().max(100).default(""),
    resume: z.string().max(10000).default(""),
    jobDescription: z.string().max(6000).default(""),
    questionCount: z.number().int().min(3).max(8),
  })
  .strict();
const text = z.string().trim().min(1).max(3000);
const score = z.number().int().min(0).max(100);
export const dimensions = [
  "correctness",
  "depth",
  "clarity",
  "structure",
  "relevance",
  "reasoning",
  "evidence",
  "practicality",
];
export const evaluationSchema = z.object({
  scores: z.object(Object.fromEntries(dimensions.map((k) => [k, score]))),
  rationale: text,
  strengths: z.array(text).min(1).max(3),
  improvements: z.array(text).min(1).max(3),
  missingConcepts: z.array(text).max(4),
  modelAnswer: text,
});
export const questionSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  focus: z.string().min(1).max(150),
  difficulty: z.enum(["Foundational", "Intermediate", "Advanced"]),
});
export const turnSchema = z.object({
  evaluation: evaluationSchema,
  nextQuestion: questionSchema,
});
export const reportSchema = z.object({
  summary: text,
  strengths: z.array(text).min(1).max(5),
  improvements: z.array(text).min(1).max(5),
  studyPlan: z
    .array(
      z.object({
        day: z.number().int().min(1).max(14),
        topic: text,
        task: text,
        practiceQuestion: text,
      }),
    )
    .min(3)
    .max(7),
});
export const answerSchema = z
  .object({
    answer: z.string().trim().min(2).max(8000),
    expectedTurn: z.number().int().min(0).max(7),
  })
  .strict();
