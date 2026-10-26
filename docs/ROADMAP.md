# Product roadmap

## Next: trustworthy college pilot

1. Benchmark interview quality against human-reviewed rubrics across engineering, behavioral and product rounds. Track question relevance, false corrections, specific evidence, and whether follow-ups actually probe gaps. Calibrate model scores before interpreting score trends as improvement.
2. Add verified email and self-service recovery, onboarding consent, retention controls, backups/restore tests and abuse protections. Decide which identity provider and deployment region fit the pilot.
3. Validate with a small college cohort: onboarding completion, first report completion, time to first question, repeat practice within seven days, and usefulness ratings from actual participants. Publish testimonials only with permission.
4. Test physical webcam/microphone input on Chrome, Safari and mobile, including permissions, thermal load and accessibility. Calibrate approximate gaze/framing guidance with consenting users and measure transcription latency. Current local turn-based generation is not low-latency full-duplex voice.

## Then: better learning

- Supported PDF/DOCX extraction with strict size limits and safe parsing; never store original resumes unnecessarily.
- Sandbox coding execution with resource limits, no network access and per-language test cases. Until then, label code feedback as review only.
- Question-level rubric calibration, improved long-history summarization, editable revision notes, explicit hints/practice mode and targeted practice from study-plan topics.
- Cohort/instructor controls only after consent, access-control and privacy design; AI practice scores must not be treated as automated hiring or admissions decisions.

## Later: sustainable business (billing deferred)

Start with a useful limited free tier. Measure actual compute cost and learner retention before choosing prices. Consider a student plan, professional plan and college cohort seats; compare INR affordability and international willingness to pay using real interviews and pilots. Do not advertise unimplemented premium capabilities. Later implement server-side entitlements, payment webhooks, reconciliation, cancellation/refunds and test-mode checkout. Evaluate Indian payment availability and international coverage at that time rather than hardcoding a payment provider now.

## Scale only when needed

Move to Postgres plus distributed locks/rate limiting when one instance becomes a constraint. Add durable background generation jobs, SSE progress, provider cost budgets and resumable operations. Keep a model evaluation suite as a release gate. Avoid accumulating superficial features before reliability and coaching usefulness improve.
