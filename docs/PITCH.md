# InterviewAce for hiring teams: pitch notes

## One line

An AI interviewer that runs a real spoken video interview for every applicant, under your rules, and gives your HR team a ranked shortlist with the evidence behind every score.

## The problem

- Screening rounds eat recruiter and engineer hours, and most first-round calls end in "no".
- Take-home tests and MCQ platforms are easy to cheat with AI tools and say little about how someone thinks.
- Candidates dislike invisible proctoring, silent rejections and links that die when the Wi-Fi drops.

## What HR does (about 5 minutes per role)

1. **Create a role.** Job title, level, interview round (technical, behavioural, product…), difficulty and job description.
2. **Set the scoring.** A rubric of 2 to 6 criteria with weights. Starter rubrics are filled in per round, and HR can edit them.
3. **Write their own questions (optional).** Up to 8. Maya asks them word for word, in order, then writes follow-ups for the remaining slots from the job description and each candidate's résumé.
4. **Choose proctoring.**
   - **Strict (default):** full screen and one display are required. If the candidate leaves full screen or the tab, or connects a second display, they get a 10-second countdown and then the interview ends.
   - **Standard:** the same events are only noted for the reviewer.
5. **Invite candidates.** Paste "name, email" lines, set when the interview window opens and closes, and paste each résumé. HR gets one private link per candidate plus a ready-written email that opens in their own mail app.
6. **Review.** HR sees:
   - a ranked list with the AI estimate, the eye-contact percentage, a score per criterion and integrity flags;
   - per candidate: the full transcript, per-question scores, quotes from the candidate's own words (checked word for word against the transcript), the proctoring timeline and suggested questions for the human round;
   - an advance / hold / reject decision with a note, and CSV export.

## What the candidate experiences

- Opens the link with no sign-up. A one-page notice explains that an AI runs the interview, what is collected, the full-screen rule and how long the data is kept. The candidate accepts or withdraws.
- If they open the link early, they see "your interview opens at …".
- A device check comes first, then the interview starts in full screen. Maya asks each question aloud, and the candidate answers by voice (English and Hindi) or by typing.
- If the connection drops, the same link resumes at the same question until the window closes.
- At the end they see a thank-you page and, if the company allows it, a few "areas to prepare". They never see scores.

## Anti-cheating (built in)

| Check | How |
|---|---|
| Full screen required | Cannot join without it. Leaving starts a 10 s countdown, then the interview ends and is submitted. |
| One screen only | Joining is blocked if a second display is detected. Connecting one mid-interview triggers the same countdown. (Works in Chrome and Edge.) |
| Tab switching | Leaving the tab triggers the countdown in strict mode and is noted in both modes. |
| Eye contact | On-device camera tracking measures the share of answering time spent looking at the screen. It is shown to HR as a percentage per answer and overall. |
| Face checks | No face for 10 s, or two faces for 3 s, is flagged. |
| Paste detection | Large pastes into the typed-answer box are flagged. |
| Camera off, reconnects, new device | Each is flagged and timestamped against the question. |
| Video privacy | Video never leaves the candidate's device; only counts and percentages are sent. That makes the product easier to sell under India's DPDP Act. |

## How we compare

- **HackerRank Chakra** (generally available since October 2026):
  - Strong on coding interviews with evidence-backed scorecards, integrity monitoring, ATS integrations, SOC 2 and bias audits.
  - Pricing is enterprise "contact us".
  - Our edge: fast setup for non-tech roles too, Hindi plus English voice, company-written questions mixed with AI follow-ups, visible strict proctoring and India-friendly pricing.
- **Intervue.io** (India, 400+ companies):
  - Offers an AI screening agent and expert-led interviews; proctoring appears to be on request.
  - Our edge: proctoring is on by default and visible, and the product is self-serve.

## Honest gaps (say these if asked)

- **Email:** invites go out through HR's own mail app; no server-sent email or reminders yet.
- **Résumés:** text only, no PDF upload or parsing yet.
- **Platforms:** no ATS integrations, SSO or SOC 2 yet.
- **Scores:** AI scores are estimates and not yet calibrated against human raters. The product says so on every screen, and a person makes every decision.
- **Eye contact:** the measure depends on camera position and lighting. Use it as a signal, not a pass/fail rule; it can disadvantage some candidates (for example, people with disabilities or poor cameras).
- **Browser checks:** a determined candidate can work around browser-side checks (another device or person off camera). That is true of every browser-based proctoring tool.

## Five-minute demo script

1. **Create a role** (Hiring → New role): add 2 of your own questions and choose Strict proctoring.
2. **Invite yourself:** set the window to now, paste a short résumé, and click Email.
3. **Take the interview:** open the link in Chrome, accept the notice and join (it goes full screen). Answer the first question.
4. **Press Esc:** the countdown appears. Return to full screen to show the recovery, then let it expire on a second run to show the auto-end.
5. **Back in Hiring:** show the ranked list (eye contact column, "Ended by proctoring" badge), then open the report: transcript, quotes and the flag timeline.
