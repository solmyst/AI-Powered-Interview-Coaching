// Observable geometry only. These heuristics do not establish emotion, confidence,
// true eye contact, or medical/ergonomic posture.
export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};
export type FrameSignals = {
  face: boolean;
  gazeAligned: boolean | null;
  centered: boolean | null;
  headTilt: number | null;
  shoulderTilt: number | null;
};
export type VisualSummary = {
  samples: number;
  observedMs: number;
  faceSamples: number;
  gazeSamples: number;
  alignedGazeSamples: number;
  centeredSamples: number;
  headLevelSamples: number;
  shoulderSamples: number;
  levelShoulderSamples: number;
};
export const emptyVisual = (): VisualSummary => ({
  samples: 0,
  observedMs: 0,
  faceSamples: 0,
  gazeSamples: 0,
  alignedGazeSamples: 0,
  centeredSamples: 0,
  headLevelSamples: 0,
  shoulderSamples: 0,
  levelShoulderSamples: 0,
});
function tilt(a: Landmark, b: Landmark, aspect: number) {
  const [left, right] = a.x < b.x ? [a, b] : [b, a];
  return (
    (Math.atan2(right.y - left.y, (right.x - left.x) * aspect) * 180) / Math.PI
  );
}
function irisRatio(a: Landmark, b: Landmark, iris: Landmark) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length < 0.00001) return null;
  return ((iris.x - a.x) * dx + (iris.y - a.y) * dy) / length;
}
export function frameSignals(
  face: Landmark[] | undefined,
  pose: Landmark[] | undefined,
  aspect = 4 / 3,
): FrameSignals {
  const result: FrameSignals = {
    face: Boolean(face?.length),
    gazeAligned: null,
    centered: null,
    headTilt: null,
    shoulderTilt: null,
  };
  if (
    face?.[468] &&
    face[473] &&
    face[33] &&
    face[133] &&
    face[362] &&
    face[263]
  ) {
    const left = irisRatio(face[33], face[133], face[468]);
    const right = irisRatio(face[362], face[263], face[473]);
    // Exclude closed eyes; use a permissive geometric tolerance, not a calibrated gaze angle.
    const open =
      face[159] &&
      face[145] &&
      face[386] &&
      face[374] &&
      Math.abs(face[159].y - face[145].y) > 0.006 &&
      Math.abs(face[386].y - face[374].y) > 0.006;
    if (open && left !== null && right !== null)
      result.gazeAligned =
        Math.abs(left - 0.5) < 0.22 && Math.abs(right - 0.5) < 0.22;
    result.headTilt = tilt(face[33], face[263], aspect);
  }
  if (face?.[1])
    result.centered =
      face[1].x > 0.25 &&
      face[1].x < 0.75 &&
      face[1].y > 0.2 &&
      face[1].y < 0.75;
  const a = pose?.[11],
    b = pose?.[12];
  if (
    a &&
    b &&
    (a.visibility ?? 0) > 0.7 &&
    (b.visibility ?? 0) > 0.7 &&
    Math.abs(a.x - b.x) > 0.08
  )
    result.shoulderTilt = tilt(a, b, aspect);
  return result;
}
export function accumulate(
  summary: VisualSummary,
  frame: FrameSignals,
  elapsedMs: number,
): VisualSummary {
  return {
    samples: summary.samples + 1,
    observedMs:
      summary.observedMs + Math.round(Math.min(500, Math.max(0, elapsedMs))),
    faceSamples: summary.faceSamples + Number(frame.face),
    gazeSamples: summary.gazeSamples + Number(frame.gazeAligned !== null),
    alignedGazeSamples:
      summary.alignedGazeSamples + Number(frame.gazeAligned === true),
    centeredSamples: summary.centeredSamples + Number(frame.centered === true),
    headLevelSamples:
      summary.headLevelSamples +
      Number(frame.headTilt !== null && Math.abs(frame.headTilt) < 12),
    shoulderSamples:
      summary.shoulderSamples + Number(frame.shoulderTilt !== null),
    levelShoulderSamples:
      summary.levelShoulderSamples +
      Number(frame.shoulderTilt !== null && Math.abs(frame.shoulderTilt) < 10),
  };
}
export function combineVisual(values: VisualSummary[]): VisualSummary {
  const total = emptyVisual();
  for (const value of values)
    for (const key of Object.keys(total) as (keyof VisualSummary)[])
      total[key] += value[key];
  return total;
}
export function percentage(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : null;
}
