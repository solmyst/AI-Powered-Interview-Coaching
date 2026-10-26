# Voice interview UX benchmark

Research completed October 2026 before rebuilding the live room.

## Patterns worth adopting

- **Conversation, not a form.** micro1 describes Zara as a conversational AI recruiter, while Final Round AI says candidates answer out loud as they would on a face-to-face call. InterviewAce therefore has no typed-answer field in the interview room.
- **One preflight, then automatic turns.** HireVue checks camera and microphone before the interview; Final Round AI checks the required audio before starting. InterviewAce checks its server-side AssemblyAI connection, explains privacy and headphones, and requests media before the candidate joins.
- **Unambiguous turn state.** Final Round AI exposes Speaking, Listening and Thinking states so candidates know whose turn it is. InterviewAce uses the same interaction principle.
- **Interviewer captions, not a live self-transcript.** Final Round AI shows the interviewer’s spoken line but deliberately does not show the candidate’s live transcript, helping the candidate continue speaking naturally instead of editing text. InterviewAce keeps the answer transcript out of the call and exposes it after submission in the report/history.
- **Private self-view and focused call controls.** Mature tools prioritize the interviewer, camera self-view, timer/progress and a small set of call controls instead of displaying configuration panels during the interview.
- **Adaptive follow-ups and post-call debrief.** Yoodli mixes preset questions with dynamic follow-ups; micro1 provides structured results; Google Interview Warmup provides transcript-derived insights after speaking. InterviewAce retains server-generated adaptive follow-ups and produces its coaching report after the call.

## Deliberate differences

- InterviewAce stores transcripts and aggregate delivery counts, but not video, audio, frames or raw landmarks.
- Camera signals remain coaching prompts and are not used as answer-quality or hiring scores.
- The current voice loop is turn-based: the interviewer speaks, then the candidate speaks. True interruption/barge-in and low-latency streaming model responses remain future work.
- A repeat-question control remains available for accessibility and transcription recovery.

## Sources

- [micro1 AI interview guide](https://www.micro1.ai/ai-interview-guide)
- [Final Round AI: inside the interviewer window](https://docs.finalroundai.com/docs/mock-interviews/mock-video-window)
- [Final Round AI: starting a practice interview](https://docs.finalroundai.com/docs/mock-interviews/starting-a-mock)
- [Yoodli practice and interview roleplay](https://support.yoodli.ai/en/articles/9550465-practice-with-yoodli)
- [HireVue candidate FAQ](https://www.hirevue.com/candidates/faq)
- [HireVue: how to take an interview](https://www.hirevue.com/blog/candidates/how-to-take-a-hirevue-interview)
- [Google Interview Warmup](https://grow.google/certificates/interview-warmup/)
