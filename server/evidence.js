// Keep script marks (including Hindi vowel signs) and negation. Never accept an empty or partial-word quote.
export const normalize = (text) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
export function quoteIn(answer, quote, minimumLength = 4) {
  const normalized = normalize(quote);
  return (
    normalized.length >= minimumLength &&
    ` ${normalize(answer)} `.includes(` ${normalized} `)
  );
}

// Source-owned excerpts: judges select IDs instead of reproducing/translating the candidate's words.
export function evidenceSpans(answer) {
  const spans = [];
  const sentences = new Intl.Segmenter(undefined, {
    granularity: "sentence",
  }).segment(answer);
  for (const sentence of sentences) {
    let cursor = sentence.index;
    const end = cursor + sentence.segment.length;
    while (cursor < end) {
      let cut = Math.min(cursor + 220, end);
      if (cut < end) {
        const boundary = answer.lastIndexOf(" ", cut);
        if (boundary > cursor + 80) cut = boundary;
        if (/[\uD800-\uDBFF]/u.test(answer[cut - 1])) cut--;
      }
      const raw = answer.slice(cursor, cut);
      const text = raw.trim();
      if (text) {
        const start = cursor + raw.indexOf(text);
        spans.push({
          id: `s${spans.length + 1}`,
          start,
          end: start + text.length,
          text,
        });
      }
      cursor = cut;
    }
  }
  return spans;
}
