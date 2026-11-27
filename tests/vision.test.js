import { test } from "node:test";
import assert from "node:assert/strict";
import {
  frameSignals,
  accumulate,
  emptyVisual,
  combineVisual,
  percentage,
} from "../src/product/vision/metrics.ts";
import { answerSchema } from "../server/schemas.js";
function landmarks() {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  face[33] = { x: 0.3, y: 0.4 };
  face[133] = { x: 0.4, y: 0.4 };
  face[468] = { x: 0.35, y: 0.4 };
  face[362] = { x: 0.6, y: 0.4 };
  face[263] = { x: 0.7, y: 0.4 };
  face[473] = { x: 0.65, y: 0.4 };
  face[159].y = 0.39;
  face[145].y = 0.41;
  face[386].y = 0.39;
  face[374].y = 0.41;
  return face;
}
test("centered eyes and upright head do not inherit old sign/180-degree errors", () => {
  const f = frameSignals(landmarks(), undefined);
  assert.equal(f.gazeAligned, true);
  assert.equal(f.headTilt, 0);
  assert.equal(f.centered, true);
});
test("reversed eye corner order, blinks and missing faces have correct semantics", () => {
  const face = landmarks();
  [face[33], face[133]] = [face[133], face[33]];
  assert.equal(frameSignals(face, undefined).gazeAligned, true);
  face[159].y = face[145].y;
  assert.equal(frameSignals(face, undefined).gazeAligned, null);
  assert.deepEqual(frameSignals(undefined, undefined), {
    face: false,
    gazeAligned: null,
    headTilt: null,
    shoulderTilt: null,
    centered: null,
  });
});
test("shoulders require visible landmarks and missing observations stay missing", () => {
  const pose = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  pose[11] = { x: 0.2, y: 0.6, visibility: 0.9 };
  pose[12] = { x: 0.8, y: 0.6, visibility: 0.9 };
  assert.equal(frameSignals(undefined, pose).shoulderTilt, 0);
  pose[11].visibility = 0.2;
  assert.equal(frameSignals(undefined, pose).shoulderTilt, null);
  assert.equal(percentage(0, 0), null);
});
test("aggregate camera coverage excludes long background gaps and combines samples", () => {
  const s = accumulate(
    emptyVisual(),
    frameSignals(landmarks(), undefined),
    100000,
  );
  assert.equal(s.observedMs, 500);
  const total = combineVisual([s, s]);
  assert.equal(total.faceSamples, 2);
  assert.equal(total.observedMs, 1000);
});
test("delivery schema accepts only bounded aggregate data, rejects raw frames and confidence inference", () => {
  const valid = {
    answer: "Example",
    expectedTurn: 0,
    delivery: { visual: emptyVisual(), selfConfidence: 3 },
  };
  assert.equal(answerSchema.safeParse(valid).success, true);
  assert.equal(
    answerSchema.safeParse({
      ...valid,
      delivery: { frames: ["private image"] },
    }).success,
    false,
  );
  assert.equal(
    answerSchema.safeParse({ ...valid, delivery: { confidence: 90 } }).success,
    false,
  );
  assert.equal(
    answerSchema.safeParse({
      ...valid,
      delivery: { visual: { ...emptyVisual(), faceSamples: 50 } },
    }).success,
    false,
  );
});
test("looking away is counted as an episode only after a full second, and a lost face after two", () => {
  const frame = (face, gazeAligned) => ({
    face,
    gazeAligned,
    centered: null,
    headTilt: null,
    shoulderTilt: null,
  });
  let v = emptyVisual();
  // 3 frames of 400 ms looking away = 1.2 s: one episode, no double count on later frames.
  for (let i = 0; i < 5; i++) v = accumulate(v, frame(true, false), 400);
  assert.equal(v.awayEpisodes, 1);
  assert.equal(v.awayMs, 2000);
  // A blink (unknown gaze) does not end the run; looking back does.
  v = accumulate(v, frame(true, null), 400);
  assert.equal(v.awayEpisodes, 1);
  v = accumulate(v, frame(true, true), 400);
  for (let i = 0; i < 3; i++) v = accumulate(v, frame(true, false), 400);
  assert.equal(v.awayEpisodes, 2);
  // Under a second is not an episode.
  let short = accumulate(emptyVisual(), frame(true, false), 400);
  short = accumulate(short, frame(true, true), 400);
  assert.equal(short.awayEpisodes, 0);
  // Face out of view: 2 s needed.
  let lost = emptyVisual();
  for (let i = 0; i < 4; i++) lost = accumulate(lost, frame(false, null), 500);
  assert.equal(lost.lostEpisodes, 1);
  assert.equal(lost.lostMs, 2000);
});
