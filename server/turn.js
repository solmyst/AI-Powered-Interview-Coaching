import { answerReplySchema, talkReplySchema } from "./schemas.js";

// Shared by practice and screening. The server decides whether the candidate's words are chat or an
// answer (see intentOf), because a small model sometimes treats a real answer as chat or the reverse.
const midInterview = "You are mid-interview, speaking with the candidate. ";
export const talkTask =
  midInterview +
  "Their latest words (candidateSaid) are not an answer yet: they ask something about the question, want it repeated, ask for a moment, or think aloud. Set kind to 'conversation' and nextQuestion to null. reply is one to three short spoken sentences, like a human interviewer: answer what they asked about the question, restate it more simply using only what currentQuestion already says (never add detail about the problem or hint at what could go wrong), or reassure them if they need time. Never praise, grade or react to the quality of anything they said, never confirm or hint that an approach is right or wrong, and never give away any part of the solution. If they ask for an example, give one from everyday non-technical life (a cafe, a library, a bus queue), never from the candidate's field, and never describe how the real problem is solved. If they ask whether their idea is right, say you would like to hear their full answer first. End by inviting them to go ahead.";
export const answerTask =
  midInterview +
  "The candidate's latest words (candidateSaid) are their answer to currentQuestion, even if weak, partial or 'I don't know'. Set kind to 'answer' and reply to an empty string. nextQuestion follows these rules: ";
export const nextQuestionTask =
  "ONE nextQuestion, written the way a thoughtful human interviewer talks. nextQuestion.lead: one short spoken sentence reacting to what the candidate actually said (when they said something concrete, name that exact detail in your own words; when the answer was empty or 'I don't know', reassure them briefly and kindly without judging; never reuse a stock phrase, vary the wording every turn and never say 'let's look at something different' after a real answer). nextQuestion.question: never repeat or reword anything in alreadyAsked, and do not stay on the same scenario. Use a concrete situational question ('Imagine…', 'Suppose…', 'Tell me about a time…') answerable in about two minutes of speech. Prefer realistic workplace scenarios over résumé recaps. The lead never asks anything and never suggests an approach, technique, tool or hint toward the answer; it only reacts. The question is one or two sentences, at most 45 words, with exactly one question mark.";
// Small models sometimes leak CJK characters into English text; Hindi uses Devanagari and is unaffected.
const stray = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g;
// The lead is spoken before the question, so it must be a plain remark: no asking, no echo, no cut-off sentence.
// Praise or grading in chat tells the candidate how they are doing, so the spoken reply drops it.
export const tidyReply = (reply) =>
  reply
    .replace(stray, "")
    .replace(
      /^(?:(?:good|great|nice|excellent|exactly|correct|right|solid|sure)\b[^.!?\n]*[.!]\s*|(?:that'?s|that is|you'?re|you are) (?:a |an |on the |)?(?:good|great|reasonable|solid|right|correct|nice|excellent)[^.!?\n]*[.!]\s*)+/i,
      "",
    )
    .trim();
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
        !/\?|^(could|can|would|will) you\b|\b(tell|walk) me\b|\b(one approach|an approach|you could|you might|consider|try using|a good way|comes to mind)\b/i.test(
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
const gaveUp =
  /\b(don'?t know|do not know|no idea|no clue|can'?t answer|cannot answer|not sure how|never (done|worked|used|faced|seen)|haven'?t (done|worked|used|faced|seen)|pass|skip|move on|next question)\b/i;
const chat =
  /^[\s,.]*(?:(?:um+|uh+|hmm+|well|so|ok(?:ay)?|sorry|wait|excuse me)[\s,.]*)*(what|why|how|which|who|can|could|would|do|does|did|is|are|should|will)\b|\b(repeat|rephrase|clarify|come again|again|one more time|what do you mean|give me a|a (second|moment|minute)|let me think|bear with|didn'?t (get|catch|understand)|example|you mean|hello|ready)\b/i;
// "answer" unless the words are short and clearly a question, a request or a stalling noise.
export function intentOf(said, exchanges = []) {
  const text = said.trim();
  const count = text.split(/\s+/).length;
  if (exchanges.length >= 3 || count >= SUBSTANTIAL) return "answer";
  if (
    !text.includes("?") &&
    gaveUp.test(text) &&
    !/\b(mean|repeat|understand)\b/i.test(text)
  )
    return "answer";
  if (count <= 3 || text.includes("?") || chat.test(text)) return "talk";
  return "answer";
}
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
  const talk = intentOf(answer, exchanges) === "talk";
  // The final answer needs no reply or next question, so skip the model call and close at once.
  if (last && !talk)
    return {
      answered: true,
      last,
      nextQuestion: null,
      usage: { input: 0, output: 0 },
    };
  const thin = answer.trim().split(/\s+/).length < 8;
  const next = `${nextQuestionTask} ${
    thin
      ? "The answer was almost empty, so leave this topic: switch to a different, more approachable topic from alreadyAsked."
      : "The lead and the question must refer to a specific detail the candidate actually said."
  }`;
  const task = `${persona.intro || ""}${
    talk
      ? talkTask
      : `${answerTask}${next} The candidate has finished this question: treat this as kind answer.`
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
    !talk &&
    (!value.nextQuestion || repeats(value.nextQuestion.question, asked));
  const options = { mode: persona.mode };
  const schema = talk ? talkReplySchema : answerReplySchema;
  let generated = await ai.generate(schema, task, context, options);
  // A missing or repeated question feels robotic. A real answer gets one regeneration; an almost
  // empty one skips it, because waiting for a second model call only adds silence.
  if (needsRetry(generated.value) && !thin) {
    const retry = await ai.generate(
      schema,
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
  if (talk)
    return {
      answered: false,
      last,
      reply:
        tidyReply(value.reply) ||
        "Take your time. Go ahead whenever you're ready.",
      usage: generated.usage,
    };
  return {
    answered: true,
    last,
    nextQuestion: tidyQuestion(value.nextQuestion),
    usage: generated.usage,
  };
}
