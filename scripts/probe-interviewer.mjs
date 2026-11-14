// Real-model probe: node --env-file=.env scripts/probe-interviewer.mjs [runs]
import { createAI } from "../server/ai.js";
import { decideTurn } from "../server/turn.js";
const ai = createAI();
const runs = Number(process.argv[2] || 2);
const q = (question) => ({ question, focus: "Judgment", lead: "" });
const base = () => ({
  setup: { role: "Backend engineer", experience: "2-4 years", track: "Technical", difficulty: "Medium", industry: "Fintech", company: "" },
  questionCount: 5,
  turns: [{ question: q("Tell me about yourself and a recent project."), answer: "I built a payments API in Node with Postgres and handled retries." }],
  currentQuestion: q("Imagine two requests for the same payment arrive at once. How do you make sure the customer is charged only once?"),
  exchanges: [],
});
const cases = [
  ["strong answer", "I would put an idempotency key on each payment request, store it with a unique constraint in Postgres, and return the saved result if the same key comes again. Inside a transaction so two requests racing cannot both insert.", "answer"],
  ["short real answer", "I would use a lock on the payment record", "answer"],
  ["i don't know", "I don't know, I have not worked on that.", "answer"],
  ["clarify", "What do you mean by two requests at once?", "conversation"],
  ["repeat", "Sorry, can you repeat the question?", "conversation"],
  ["ask example", "Can you give me an example of what you are looking for?", "conversation"],
  ["need time", "Hmm, give me a second to think about it.", "conversation"],
  ["think aloud", "Okay so, let me think, the payment, hmm, maybe", "conversation"],
  ["answer with ask", "I would check the database before charging, is that what you mean?", "answer"],
];
const out = [];
for (const [name, said, want] of cases)
  for (let i = 0; i < runs; i++) {
    const s = base(); const t0 = Date.now();
    const r = await decideTurn(ai, s, said);
    const got = r.answered ? "answer" : "conversation";
    out.push(got === want);
    console.log(`${got === want ? "OK  " : "MISS"} ${name} [${Date.now() - t0}ms] ${got}\n     ${r.answered ? `lead: ${r.nextQuestion.lead}\n     q: ${r.nextQuestion.question}` : `reply: ${r.reply}`}`);
  }
console.log(`\n${out.filter(Boolean).length}/${out.length} classified as wanted`);
