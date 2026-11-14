import { z } from "zod";
import { readFileSync } from "node:fs";
// readFileSync instead of a JSON import keeps Node 22 support without warnings.
const options = JSON.parse(
  readFileSync(
    new URL("../shared/interview-options.json", import.meta.url),
    "utf8",
  ),
);
// The setup form reads the same file, so client and server options cannot drift.
export const { roles, tracks, experience, difficulty } = options;
export const setupSchema = z
  .object({
    role: z.enum(roles),
    experience: z.enum(experience),
    track: z.enum(tracks),
    difficulty: z.enum(difficulty),
    industry: z.string().trim().min(1).max(80),
    company: z.string().trim().max(100).default(""),
    resume: z.string().max(10000).default(""),
    jobDescription: z.string().max(6000).default(""),
    questionCount: z.number().int().min(3).max(8),
  })
  .strict();
const text = z.string().trim().min(1).max(3000);
// Screening: a role is the setup form plus a company-written rubric.
export const rubricItem = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(400),
  weight: z.number().int().min(1).max(5),
});
export const roleConfigSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    role: z.enum(roles),
    experience: z.enum(experience),
    track: z.enum(tracks),
    difficulty: z.enum(difficulty),
    industry: z.string().trim().min(1).max(80),
    jobDescription: z.string().trim().min(50).max(6000),
    questionCount: z.number().int().min(3).max(8),
    rubric: z
      .array(rubricItem)
      .min(2)
      .max(6)
      .refine(
        (items) => new Set(items.map((i) => i.key)).size === items.length,
        "Rubric keys must be unique",
      ),
    inviteDays: z.number().int().min(1).max(30).default(7),
    candidateFeedback: z.enum(["none", "summary"]).default("summary"),
  })
  .strict();
export const screeningEvaluationSchema = (rubric) =>
  z.object({
    scores: z.object(
      Object.fromEntries(
        rubric.map((r) => [r.key, z.number().int().min(0).max(100)]),
      ),
    ),
    evidence: z
      .array(
        z.object({
          competency: z.enum(rubric.map((r) => r.key)),
          quote: z.string().trim().min(8).max(300),
          supports: z.enum(["strength", "concern"]),
        }),
      )
      .max(6),
    rationale: z.string().trim().min(1).max(1200),
    followUpForHuman: z.string().trim().max(300).optional(),
  });
export const screeningReportSchema = z.object({
  summary: z.string().trim().min(1).max(1500),
  strengths: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
  concerns: z.array(z.string().trim().min(1).max(400)).max(4),
  suggestedFollowUps: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
});
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
  // Spoken before the question: a greeting, a reaction to the last answer, or a transition.
  lead: z.string().trim().max(300),
  question: z.string().trim().min(1).max(1200),
  focus: z.string().min(1).max(150),
  difficulty: z.enum(difficulty),
});
// One fast call per candidate utterance: either talk back about the current question, or move on.
export const replySchema = z.object({
  kind: z.enum(["answer", "conversation"]),
  reply: z.string().trim().max(600),
  nextQuestion: questionSchema.nullable(),
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
const count = z.number().int().min(0).max(100000);
export const visualSchema = z
  .object({
    samples: count,
    observedMs: z.number().int().min(0).max(7200000),
    faceSamples: count,
    gazeSamples: count,
    alignedGazeSamples: count,
    centeredSamples: count,
    headLevelSamples: count,
    shoulderSamples: count,
    levelShoulderSamples: count,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.faceSamples > v.samples ||
      v.gazeSamples > v.faceSamples ||
      v.alignedGazeSamples > v.gazeSamples ||
      v.centeredSamples > v.faceSamples ||
      v.headLevelSamples > v.faceSamples ||
      v.shoulderSamples > v.samples ||
      v.levelShoulderSamples > v.shoulderSamples ||
      v.observedMs > v.samples * 500
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent visual sample counts",
      });
  });
export const deliverySchema = z
  .object({
    visual: visualSchema.optional(),
    speech: z
      .object({
        source: z.literal("assemblyai"),
        captureMs: z.number().int().min(0).max(7200000),
        words: count,
        fillers: count,
      })
      .strict()
      .optional(),
    selfConfidence: z.number().int().min(1).max(5).optional(),
  })
  .strict();
export const answerSchema = z
  .object({
    answer: z.string().trim().min(2).max(8000),
    expectedTurn: z.number().int().min(0).max(7),
    delivery: deliverySchema.optional(),
  })
  .strict();
