import { replySchema } from "./schemas.js";

// Shared by practice and screening: one fast call decides whether the candidate asked something
// or answered, and (when they answered) produces the next question.
export const replyTask =
  "You are mid-interview, speaking with the candidate. Decide what their latest words (candidateSaid) are. kind 'conversation': they ask you something (what do you mean, can you repeat, can you give an example, is it okay to…), ask for a moment, or think aloud without really answering yet. Then reply like a human interviewer in one to three short spoken sentences: answer their question about the question, restate it more simply if they were confused, or reassure them if they need time; never give away the answer or any part of the solution: if they ask for an example, give one from a different, simpler topic; end by inviting them to go ahead. nextQuestion is null. kind 'answer': they attempted an answer, even a weak or partial one, or clearly said they cannot answer or want to move on. Then reply is an empty string and nextQuestion follows these rules: ";
export const nextQuestionTask =
  "ONE nextQuestion, written the way a thoughtful human interviewer talks. nextQuestion.lead: one short spoken sentence reacting to what the candidate actually said (name a specific good point, or, if the answer was empty, off-topic or 'I don't know', reassure briefly without judging, e.g. 'No problem, let's look at something different.'). nextQuestion.question: never repeat or reword anything in alreadyAsked, and do not stay on the same scenario. Use a concrete situational question ('Imagine…', 'Suppose…', 'Tell me about a time…') answerable in about two minutes of speech. Prefer realistic workplace scenarios over résumé recaps. The lead never asks anything. The question is one or two sentences, at most 45 words, with exactly one question mark.";
// Small models sometimes leak CJK characters into English text; Hindi uses Devanagari and is unaffected.
const stray = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g;
// The lead is spoken before the question, so it must be a plain remark: no asking, no echo, no cut-off sentence.
export const tidyQuestion = (q) => ({
  ...q,
  question: q.question
    .replace(stray, "")
    .replace(/\s{2,}/g, " ")
    .trim(),
  lead: (q.lead || "")
    .replace(stray, "")
    .split(/(?<=[.!?])\s+/)
    .filter(
      (sentence) =>
        /[.!]$/.test(sentence.trim()) &&
        !/\?|^(could|can|would|will) you\b|\b(tell|walk) me\b/i.test(
          sentence,
        ) &&
        !repeats(sentence, [q]),
    )
    .join(" "),
});
// Used only when the model keeps repeating itself, so the interview never stalls on one question.
export const fallbackQuestions = [
  "Imagine your team ships a release and, an hour later, users report that checkout is failing. What do you do in the first fifteen minutes?",
  "Suppose a teammate's pull request works but is hard to read. How would you give feedback, and what would you want to see change?",
  "Imagine you are given a task with unclear requirements and a deadline in two days. How do you get unstuck?",
  "Suppose a page you built loads slowly for users on weak connections. How would you find the cause and what would you try first?",
];
// Only words of 4+ letters count, so "would you what" filler cannot hide a reworded question.
const words = (text) =>
  new Set(text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
// True when a new question shares at least three, and half or more, of its meaningful words with one already asked.
export function repeats(question, asked) {
  const next = words(question);
  return asked.some((earlier) => {
    const before = words(
      typeof earlier === "string" ? earlier : earlier.question,
    );
    const shared = [...next].filter((w) => before.has(w)).length;
    return shared >= 3 && shared / Math.min(next.size, before.size) >= 0.5;
  });
}

const SUBSTANTIAL = 15;
// When a question closes, substantive earlier statements on it stay with the answer instead of being lost
// in the chat: "what do you mean?" is dropped, but a real attempt made before the final words is kept.
export function answerOf(exchanges, final) {
  const earlier = (exchanges || [])
    .map((e) => e.said)
    .filter(
      (said) => said.trim().split(/\s+/).length >= 8 && !said.includes("?"),
    );
  return [...earlier, final].join("\n\n");
}

// Decides what the candidate's latest words were and, for an answer, the next question.
// Returns { answered, last, reply, nextQuestion, usage }; the caller applies it to its own storage.
// persona: { intro, mode } lets screening change the wording without a second code path.
export async function decideTurn(ai, session, answer, persona = {}) {
  const last = session.turns.length + 1 >= session.setup.questionCount;
  const asked = [
    ...session.turns.map((t) => t.question),
    session.currentQuestion,
  ];
  const exchanges = session.exchanges || [];
  const wordCount = answer.trim().split(/\s+/).length;
  // A long statement that asks nothing is an answer. Small models sometimes call it conversation,
  // which would discard a real answer. Also, after three back-and-forths the next words count.
  const mustAnswer =
    exchanges.length >= 3 ||
    (wordCount >= SUBSTANTIAL && !answer.includes("?"));
  const thin = wordCount < 8;
  const next = last
    ? "This was the final question, so nextQuestion is null."
    : `${nextQuestionTask} ${
        thin
          ? "If this is an answer, it was almost empty, so leave this topic: switch to a different, more approachable topic from alreadyAsked."
          : "If this is an answer, the lead and the question must refer to a specific detail the candidate actually said."
      }`;
  const task = `${persona.intro || ""}${replyTask}${next}${
    mustAnswer
      ? " The candidate has already talked about this question several times: treat this as kind answer."
      : ""
  }`;
  const context = {
    setup: {
      role: session.setup.role,
      experience: session.setup.experience,
      track: session.setup.track,
      difficulty: session.setup.difficulty,
      industry: session.setup.industry,
      company: session.setup.company,
    },
    earlierAnswers: session.turns.map((t) => ({
      question: t.question.question,
      answer: t.answer.slice(0, 1200),
    })),
    alreadyAsked: asked.map((q) => q.question),
    currentQuestion: session.currentQuestion,
    conversationAboutCurrentQuestion: exchanges,
    candidateSaid: answer,
  };
  const needsRetry = (value) =>
    (value.kind === "answer" || mustAnswer) &&
    !last &&
    (!value.nextQuestion || repeats(value.nextQuestion.question, asked));
  const options = { mode: persona.mode };
  let generated = await ai.generate(replySchema, task, context, options);
  // A missing or repeated question feels robotic. A real answer gets one regeneration; an almost
  // empty one skips it, because waiting for a second model call only adds silence.
  if (needsRetry(generated.value) && !thin) {
    const retry = await ai.generate(
      replySchema,
      `${task} IMPORTANT: treat this as kind answer and give a nextQuestion about a clearly different situation or skill than ${JSON.stringify(generated.value.nextQuestion?.question || "")}.`,
      context,
      options,
    );
    generated = {
      value: retry.value,
      usage: {
        input: generated.usage.input + retry.usage.input,
        output: generated.usage.output + retry.usage.output,
      },
    };
  }
  if (needsRetry(generated.value)) {
    const question = fallbackQuestions.find((q) => !repeats(q, asked));
    if (question)
      generated.value = {
        kind: "answer",
        reply: "",
        nextQuestion: {
          lead: "Let's look at it from a different angle.",
          question,
          focus: "Problem solving",
          difficulty: session.setup.difficulty,
        },
      };
  }
  const { value } = generated;
  const answered = value.kind === "answer" || mustAnswer;
  if (!answered || (!last && !value.nextQuestion))
    return {
      answered: false,
      last,
      reply: value.reply || "Take your time. Go ahead whenever you're ready.",
      usage: generated.usage,
    };
  return {
    answered: true,
    last,
    nextQuestion: last ? null : tidyQuestion(value.nextQuestion),
    usage: generated.usage,
  };
}
