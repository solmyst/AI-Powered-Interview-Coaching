# How screening answers are scored

Code: `server/scoring.js`. Probe against the real model: `node --env-file=.env scripts/probe-scoring.mjs ../server/scoring.js`.

## Why it was rebuilt

The first version asked the model for a free 0 to 100 number per criterion. Measured against the real model:

- The same answer scored 0 on one run and 28 on the next, and 32 then 51 for a candidate who only restated the question.
- Communication and empathy got 35 to 55 for restating the question, because the model rewarded fluency.
- The overall was averaged over the questions the candidate answered, so a candidate who left after one answer kept that answer's score.

## The method (per answer)

1. **Gate (no model).** An answer that adds fewer than 8 content words beyond the question, or says "I don't know", scores 0 on every criterion. Restating the question, filler and one-word replies end here.
2. **Reference outline.** The model lists 3 to 5 points a strong answer would make, once per question and role. Every candidate is judged against the same outline. It is a guide, not a checklist.
3. **Anchored levels, three judgements.** The model scores each criterion on a 0 to 4 scale with fixed anchors (0 none, 1 generic, 2 partly specific, 3 specific and reasoned, 4 also weighs trade-offs, risks or measures). Three independent judgements run in parallel; the median level is used. A level maps to 0, 20, 45, 75 or 95.
4. **Server rules the model cannot change.**
   - A level of 2 or more needs a verbatim quote the candidate really said; otherwise it is capped at 1.
   - Communication can be at most one level above the best content criterion.
   - If most judgements say the answer is off-topic or has no substance of its own, every criterion is 0.
5. **Delivery is never an input.** Eye contact, looking away, filler words and pace are shown beside the estimate, not inside it.

## The method (per candidate)

- Overall = weighted average (the role's weights) over **all** questions. A question not answered counts as 0, so ending early cannot raise a score. The average of answered questions is shown separately.
- Band: Strong 75 and up, Promising 60 to 74, Mixed 40 to 59, Weak below 40. **Not enough to judge** when fewer than half the questions were answered or half the answers had no content: treat it as "not assessed".
- Confidence is "low" when judgements disagreed by 2 or more levels, or a score lost credit for missing a quote.

## Measured behaviour (real model, 3 to 4 runs each)

| Answer | Before | After |
|---|---|---|
| "I don't know" | 0 | 0 |
| Filler only | 0 or 28 | 0 |
| Off topic | 0 or 10 | 0 |
| Restates the question | 32 to 51 | 0 |
| Generic, no specifics | 29 to 35 | 20 every run |
| Decent, specific answer | 70 to 77 | 50 to 70 |
| Strong, with measures | 74 to 85 | 70 to 86 |

End to end through the app: a candidate who gave filler and "I don't know" scored 0 (before: about 15); a candidate with specific answers scored 63.

## Known limits

- The model rarely awards level 4, so top scores cluster around 75. Bands and ranking still separate weak, generic and specific answers.
- Quote matching is exact after lower-casing and removing punctuation, so a paraphrased quote is dropped.
- The scores are still model estimates. They have not been compared with human raters; do that with a set of real interviews before using them as more than a first filter.
- Practice interviews use their own, older scoring and are not changed here.

## Research behind the choices

- Structured interviews with job-related, situational questions and anchored rating scales predict job performance better than unstructured ones: [McDaniel et al., 1994 meta-analysis](https://home.ubalt.edu/tmitch/645/articles/McDanieletal1994CriterionValidityInterviewsMeta.pdf), [OPM guidance](https://www.opm.gov/policy-data-oversight/assessment-and-selection/other-assessment-methods/structured-interviews/), [validity varies widely](https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/7CB1F7C86CB0D15328B3F07AD5F964E2/S1754942623000421a.pdf/structured-interviews-moving-beyond-mean-validity.pdf). Anchored scales do not remove rater bias, so a person reviews every result.
- LLM judges give different absolute scores when a prompt is slightly changed, so scoring uses fixed anchors, one prompt, several judgements and a median: [scoring bias in LLM-as-a-judge](https://arxiv.org/html/2506.22316v1), [balanced permutations and aggregation](https://arxiv.org/pdf/2602.02219).
- Scoring against explicit criteria, with a reference outline, reduces reliance on plausibility: [evaluation protocol](https://arxiv.org/pdf/2601.22025).
- Nonverbal cues such as eye contact and filler words have no established validity for hiring, and automated tools face audit duties (for example NYC Local Law 144), so they are shown for context only: [bias audit laws](https://research.gold.ac.uk/37547/1/Bias%20audit%20laws%20%20how%20effective%20are%20they%20at%20preventing%20bias%20in%20automated%20employment%20decision%20tools%20.pdf).
