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
    // Company-written questions are asked first, in order; Maya writes the rest.
    questions: z.array(z.string().trim().min(10).max(600)).max(8).default([]),
    // strict: full screen and one display required; leaving for 10 s ends the interview.
    proctoring: z.enum(["strict", "standard"]).default("strict"),
  })
  .strict()
  .refine((c) => c.questions.length <= c.questionCount, {
    message: "Add more questions to the count, or remove some of your own.",
    path: ["questions"],
  });
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
// What the judge returns for one answer: ordinal levels (0-4, anchored in the prompt), not free 0-100 scores.
export const screeningJudgeSchema = (rubric, spanIds) =>
  z.object({
    relevant: z.boolean(),
    substantive: z.boolean(),
    levels: z.object(
      Object.fromEntries(
        rubric.map((r) => [r.key, z.number().int().min(0).max(4)]),
      ),
    ),
    evidence: z
      .array(
        z.object({
          competency: z.enum(rubric.map((r) => r.key)),
          ...(spanIds
            ? { spanId: z.enum(spanIds) }
            : { quote: z.string().trim().min(8).max(300) }),
          supports: z.enum(["strength", "concern"]),
        }),
      )
      .max(12),
    rationale: z.string().trim().min(1).max(1200),
    followUpForHuman: z.string().trim().max(300).optional(),
  });
// A short outline of what a strong answer to a question contains, so every candidate is judged against the same one.
export const referenceSchema = z.object({
  points: z.array(z.string().trim().min(3).max(400)).min(1).max(8),
});
export const screeningReportSchema = z.object({
  summary: z.string().trim().min(1).max(1500),
  strengths: z.array(z.string().trim().min(1).max(400)).min(0).max(4),
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
  strengths: z.array(text).min(0).max(3),
  improvements: z.array(text).min(1).max(3),
  missingConcepts: z.array(text).max(4),
  modelAnswer: text,
});
// Practice coaching text for one answer. The scores come from scoring.js, not from this call.
export const coachingSchema = evaluationSchema.omit({ scores: true });
// The eight practice dimensions as a rubric (equal weights), so practice answers are scored by the same method.
export const PRACTICE_RUBRIC = [
  ["correctness", "Facts and technical claims are right."],
  ["depth", "Goes beyond the surface to how and why."],
  ["clarity", "Easy to follow, in plain language."],
  [
    "structure",
    "Organised in a clear order, such as context, approach, result.",
  ],
  ["relevance", "Answers the question that was asked."],
  ["reasoning", "Explains why, weighing options and trade-offs."],
  ["evidence", "Backs claims with specifics, examples or numbers."],
  ["practicality", "Would work in a real situation, with sensible steps."],
].map(([key, description]) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
  description,
  weight: 1,
}));
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
// The server decides which of the two it is, then constrains the model to that shape.
export const answerReplySchema = replySchema.extend({
  kind: z.literal("answer"),
  // false only when the words do not try to answer the question at all
  relevant: z.boolean(),
});
export const talkReplySchema = replySchema.extend({
  kind: z.literal("conversation"),
  nextQuestion: z.null(),
});
// Relevance is decided independently of question writing. Evidence must come from the original-language answer.
export const relevanceSchema = (spanIds) =>
  z.object({
    relevant: z.boolean(),
    evidence: z.enum(["", ...spanIds]),
  });
export const turnSchema = z.object({
  evaluation: evaluationSchema,
  nextQuestion: questionSchema,
});
export const reportSchema = z.object({
  summary: text,
  strengths: z.array(text).min(0).max(5),
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
    // Optional so older browser tabs keep working.
    awayEpisodes: count.optional(),
    awayMs: z.number().int().min(0).max(7200000).optional(),
    awayRunMs: z.number().int().min(0).max(7200000).optional(),
    lostEpisodes: count.optional(),
    lostMs: z.number().int().min(0).max(7200000).optional(),
    lostRunMs: z.number().int().min(0).max(7200000).optional(),
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
