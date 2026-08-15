// Shared embedding helper — text-embedding-3-small (1536d) via the LLM gateway.
// Gateway quirk: `input` MUST be a single string. Array input silently returns
// empty vectors, so we send one request per text and run them concurrently.
import { llm, MODELS } from "./_llm.mjs";

const CONCURRENCY = 8;
const MAX_CHARS = 30000;

async function embedOne(text) {
  const resp = await llm().embeddings.create({
    model: MODELS.embed,
    input: text.slice(0, MAX_CHARS),
    encoding_format: "float",
  });
  const vec = resp.data?.[0]?.embedding;
  if (!vec?.length) throw new Error(`Embedding call returned no vector (model ${MODELS.embed})`);
  return vec;
}

/**
 * Embed an array of strings. Returns number[][] in input order.
 */
export async function embedBatch(texts) {
  const out = new Array(texts.length);
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const vecs = await Promise.all(slice.map(embedOne));
    vecs.forEach((v, j) => (out[i + j] = v));
  }
  return out;
}
