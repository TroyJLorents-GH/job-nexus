// Shared chunker — section-aware markdown splitting, ~500-token windows with overlap
// Token estimate: ~4 chars/token. 500 tokens ≈ 2000 chars, 50-token overlap ≈ 200 chars.
const MAX_CHARS = 2000;
const OVERLAP_CHARS = 200;

/**
 * Split markdown into chunks. Sections (## headings) are kept intact when they
 * fit; oversized sections fall back to sliding windows with overlap.
 * Returns [{ content, chunkIndex }].
 */
export function chunkMarkdown(markdown) {
  const text = (markdown || "").trim();
  if (!text) return [];

  // Split on markdown headings so resume sections (Experience, Skills…) stay coherent
  const sections = text.split(/(?=^#{1,3} )/m).filter((s) => s.trim());

  const pieces = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) pieces.push(buffer.trim());
    buffer = "";
  };

  for (const section of sections) {
    if (section.length <= MAX_CHARS) {
      // Pack small sections together up to the window size
      if (buffer.length + section.length > MAX_CHARS) flush();
      buffer += (buffer ? "\n\n" : "") + section;
    } else {
      flush();
      // Sliding window over oversized section
      for (let start = 0; start < section.length; start += MAX_CHARS - OVERLAP_CHARS) {
        pieces.push(section.slice(start, start + MAX_CHARS).trim());
        if (start + MAX_CHARS >= section.length) break;
      }
    }
  }
  flush();

  return pieces.map((content, chunkIndex) => ({ content, chunkIndex }));
}
