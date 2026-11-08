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
  difficulty: z.enum(difficulty),
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
