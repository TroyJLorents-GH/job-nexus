// Shared LlamaParse helper — upload file, poll job, return markdown
const BASE = "https://api.cloud.llamaindex.ai/api/parsing";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60; // 2 min ceiling

export class LowTextError extends Error {
  constructor(message = "Parsed text too short") {
    super(message);
    this.name = "LowTextError";
  }
}

function headers() {
  const key = process.env.LLAMA_CLOUD_API_KEY;
  if (!key) throw new Error("Missing LLAMA_CLOUD_API_KEY");
  return { Authorization: `Bearer ${key}` };
}

/**
 * Parse a document via LlamaParse. Accepts raw bytes + filename.
 * Returns { markdown, pageCount }. Throws LowTextError when result < 200 chars
 * (caller falls back to GPT-4o vision).
 */
export async function llamaparseToMarkdown(fileBytes, filename) {
  const form = new FormData();
  form.append("file", new Blob([fileBytes]), filename);

  const uploadResp = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!uploadResp.ok) {
    throw new Error(`LlamaParse upload failed: ${uploadResp.status} ${await uploadResp.text()}`);
  }
  const { id: jobId } = await uploadResp.json();

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusResp = await fetch(`${BASE}/job/${jobId}`, { headers: headers() });
    if (!statusResp.ok) continue;
    const job = await statusResp.json();
    if (job.status === "SUCCESS") {
      const resultResp = await fetch(`${BASE}/job/${jobId}/result/markdown`, {
        headers: headers(),
      });
      if (!resultResp.ok) {
        throw new Error(`LlamaParse result fetch failed: ${resultResp.status}`);
      }
      const data = await resultResp.json();
      const markdown = data.markdown || "";
      if (markdown.trim().length < 200) throw new LowTextError();
      return { markdown, pageCount: data.job_metadata?.job_pages ?? null };
    }
    if (job.status === "ERROR" || job.status === "CANCELED") {
      throw new Error(`LlamaParse job ${job.status}`);
    }
  }
  throw new Error("LlamaParse timed out");
}
