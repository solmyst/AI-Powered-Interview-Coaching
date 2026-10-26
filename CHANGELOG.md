# Changelog

## Unreleased

- Replaced the browser Whisper model with server-owned AssemblyAI Universal-3.5 Pro Sync transcription for faster English/Hindi interview turns and a much smaller initial download.

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
