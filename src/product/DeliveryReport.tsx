import { combineVisual, percentage } from "./vision/metrics";
import type { Turn } from "./types";
export function DeliveryReport({ turns }: { turns: Turn[] }) {
  const visual = combineVisual(
    turns.flatMap((t) => (t.delivery?.visual ? [t.delivery.visual] : [])),
  );
  const speech = turns.flatMap((t) =>
    t.delivery?.speech ? [t.delivery.speech] : [],
  );
  const ms = speech.reduce((n, s) => n + s.captureMs, 0),
    words = speech.reduce((n, s) => n + s.words, 0),
    fillers = speech.reduce((n, s) => n + s.fillers, 0);
  const confidence = turns.flatMap((t) =>
    t.delivery?.selfConfidence ? [t.delivery.selfConfidence] : [],
  );
  const sufficient = visual.samples >= 20 && visual.observedMs >= 5000;
  const values = [
    [
      "Face visible",
      percentage(visual.faceSamples, visual.samples),
      visual.samples,
    ],
    [
      "Eye direction near lens (estimate)",
      percentage(visual.alignedGazeSamples, visual.gazeSamples),
      visual.gazeSamples,
    ],
    [
      "Face centered",
      percentage(visual.centeredSamples, visual.faceSamples),
      visual.faceSamples,
    ],
    [
      "Head approximately level",
      percentage(visual.headLevelSamples, visual.faceSamples),
      visual.faceSamples,
    ],
    [
      "Shoulders approximately level",
      percentage(visual.levelShoulderSamples, visual.shoulderSamples),
      visual.shoulderSamples,
    ],
  ] as const;
  return (
    <section className="panel delivery-report">
      <p className="eyebrow">CAMERA & SPEAKING REVIEW</p>
      <h2>How you delivered your answers</h2>
      <p>
        Observable presentation cues, separate from your answer-quality score.
        These browser measurements are approximate and are not independently
        verified.
      </p>
      {sufficient ? (
        <>
          <div className="delivery-grid">
            {values.map(([label, value, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {count >= 20 && value !== null
                    ? `${value}%`
                    : "Not enough data"}
                </strong>
                <small>{count} usable samples</small>
              </div>
            ))}
          </div>
          <p>
            {Math.round(visual.observedMs / 1000)} seconds sampled across
            submitted answers. Percentages describe sampled frames, not the
            entire interview.
          </p>
          <ul className="feedback-list">
            {visual.gazeSamples >= 20 &&
              visual.alignedGazeSamples / visual.gazeSamples < 0.5 && (
                <li>
                  If looking toward the camera is your goal, place your notes
                  nearer the lens. Looking away to think is normal; this
                  detector is not a calibrated gaze tracker.
                </li>
              )}
            {visual.faceSamples >= 20 &&
              visual.centeredSamples / visual.faceSamples < 0.7 && (
                <li>
                  Try positioning the camera at eye level and keeping your face
                  comfortably within the center of the frame.
                </li>
              )}
            {visual.shoulderSamples >= 20 &&
              visual.levelShoulderSamples / visual.shoulderSamples < 0.7 && (
                <li>
                  Check camera tilt and seating comfort. Uneven shoulders in a
                  camera image do not establish poor posture.
                </li>
              )}
            {visual.shoulderSamples < 20 && (
              <li>
                Your shoulders were not reliably visible. Move the camera
                farther away if you want upper-body alignment feedback.
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="notice">
          No reliable camera summary for these answers. Enable camera coaching
          and allow at least five seconds of observation before submitting.
          Camera-off or undetected frames are not scored as poor performance.
        </p>
      )}
      <div className="two-col">
        <div>
          <h3>Speaking delivery</h3>
          {ms >= 5000 ? (
            <>
              <p>
                <strong>{Math.round(words / (ms / 60000))} words/minute</strong>{" "}
                across {Math.round(ms / 1000)} seconds of microphone capture,
                including pauses. {fillers} transcript filler matches.
              </p>
              <p>
                Use pace as a reflection prompt, not a target to maximize.
                Transcription and edits affect these counts; clarity, accent,
                and confidence are not measured from this rate.
              </p>
            </>
          ) : (
            <p>
              No timed speech sample. Typed answers do not receive speaking
              metrics.
            </p>
          )}
        </div>
        <div>
          <h3>Confidence check-in</h3>
          {confidence.length ? (
            <p>
              Your own rating averaged{" "}
              <strong>
                {(
                  confidence.reduce((a, b) => a + b, 0) / confidence.length
                ).toFixed(1)}{" "}
                / 5
              </strong>{" "}
              over {confidence.length} answered questions.
            </p>
          ) : (
            <p>No self-rating was provided.</p>
          )}
          <p>
            Confidence is self-reported. The system does not infer it from your
            face, posture, eye direction, or voice.
          </p>
        </div>
      </div>
      <small>
        Landmarks are influenced by lighting, glasses, camera position,
        visibility, and individual differences. These cues do not measure
        emotion, personality, capability, honesty, or full-body sitting posture.
      </small>
    </section>
  );
}
