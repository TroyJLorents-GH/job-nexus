// Shared embedding helper — OpenAI text-embedding-3-small (1536d), batched
import OpenAI from "openai";

let client = null;
function openai() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

/**
 * Embed an array of strings. Returns number[][] in input order.
 */
export async function embedBatch(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 30000));
    const resp = await openai().embeddings.create({ model: MODEL, input: batch });
    for (const item of resp.data) vectors.push(item.embedding);
  }
  return vectors;
}
