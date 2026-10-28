# Changelog

## Unreleased

- Fixed clipped questions on short/landscape screens, self-view overlap on mobile, missing mobile question progress, and control-bar movement between speaking/listening states.
- Added accessible briefing focus management and report-failure recovery; recording errors now pause the call, disconnected devices can reconnect, and stalled cloud speech falls back after 12 seconds.
- Added actionable session-expiry/network errors, safe startup with blocked storage, submission-locked forms and corrected Answer Lab progress states.
- Added the spoken Answer Lab: personalized checkpoints, an answer retry, a changed-scenario challenge, and a persisted side-by-side evidence review without changing original interview scores.
- Verified coaching quotations against answer transcripts on the server, with one bounded repair attempt for invalid evidence and no partial save on failure.
- Added pause/resume, question clarification, standalone spoken repeat/pause/clarify commands, and recovery when a saved-answer response is interrupted.
- Strengthened assessment guidance to accept correct equivalent solutions rather than require specific keywords or techniques.
- Replaced the browser Whisper model with server-owned AssemblyAI Universal-3.5 Pro Sync transcription for faster English/Hindi interview turns and a much smaller initial download.
- Added server-owned ElevenLabs multilingual interviewer speech with automatic browser-TTS fallback, an accessible password visibility control, and camera rendering that stays live when presence coaching is still loading or fails.

- Added a Node/SQLite backend with secure sessions, account ownership, durable usage limits and data export/deletion.
- Replaced fixed interview question lists with validated server-side Ollama/NVIDIA generation, adaptive follow-ups and answer-based coaching reports.
- Added role/resume/job-description setup, persisted progress, revision bookmarks and optional browser voice controls.
- Restored optional camera coaching with local MediaPipe face/pose analysis, local Whisper transcription and a distinct delivery report. Added self-reported confidence instead of face-based emotion/confidence claims.
- Rebuilt the practice room as a voice-first video call with preflight, automatic TTS/STT turns, silence-based answer completion, clear Speaking/Listening/Thinking states and no typed-answer form.
- Moved camera and microphone permission checks into preflight, added a real pre-join preview, reused one media stream throughout the call, and added a noisy-room answer-completion fallback.
- Added an Azure VM deployment runbook with local Ollama GPU and hosted NVIDIA alternatives, HTTPS ingress, systemd, Nginx, verification and rollback.
- Updated landing, onboarding, dashboard, room and reports while retaining the original cream/clay visual identity.
- Removed unsupported landing claims and browser-stored API-key settings from the active application. Preserved prototype source under legacy/.
- Replaced static GitHub Pages deployment with full-stack validation CI and persistent-server deployment documentation.
- Billing deferred at the user's request.
