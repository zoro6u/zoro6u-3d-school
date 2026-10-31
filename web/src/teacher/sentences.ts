const ABBREVIATIONS = ['dr', 'prof', 'mr', 'mrs', 'ms', 'st', 'vs', 'e.g', 'i.e', 'etc'];

/**
 * Split streamed text into sentences that are safe to speak now. A terminator only ends a sentence when it is
 * followed by whitespace (so "1.62 m/s²" and "H₂O." mid-stream are not cut), and common abbreviations like
 * "Dr." and "Prof." are skipped. Returns the complete sentences and the unfinished remainder.
 */
export function splitSentences(buffer: string, flush = false): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let start = 0;
  const re = /[.!?؟۔…]+(?=\s|$)|\n+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const end = m.index + m[0].length;
    if (end === buffer.length && !flush && !m[0].includes('\n')) break; // stream may continue (e.g. "9." → "9.81")
    const piece = buffer.slice(start, end).trim();
    const lastWord = piece.replace(/[.!?؟۔…]+$/, '').split(/\s+/).pop()?.toLowerCase() ?? '';
    if (m[0] === '.' && ABBREVIATIONS.includes(lastWord)) continue;
    if (piece) sentences.push(piece);
    start = end;
  }
  const rest = buffer.slice(start);
  if (flush && rest.trim()) return { sentences: [...sentences, rest.trim()], rest: '' };
  return { sentences, rest };
}
