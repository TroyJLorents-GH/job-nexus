// v2 — generic hybrid semantic search over the user's documents
import { verifyToken } from "../_auth.mjs";
import { handleCors, sendAuthError } from "../_http.mjs";
import { supabase } from "../_supabase.mjs";
import { embedBatch } from "../_embed.mjs";
import { checkRateLimit } from "../_ratelimit.mjs";

const MAX_QUERY_CHARS = 2000;

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "semantic-search"))) return;

  const query = (req.body?.query || "").slice(0, MAX_QUERY_CHARS);
  if (!query.trim()) return res.status(400).json({ error: "Missing query" });

  try {
    const [embedding] = await embedBatch([query]);
    const { data: hits, error } = await supabase().rpc("hybrid_search", {
      p_user_id: auth.userId,
      p_query_text: query,
      p_query_embedding: embedding,
      p_match_count: Math.min(Number(req.body?.limit) || 20, 50),
    });
    if (error) throw new Error(error.message);

    return res.status(200).json({
      results: (hits || []).map((h) => ({
        documentId: h.document_id,
        chunkId: h.chunk_id,
        content: h.content,
        score: h.score,
      })),
    });
  } catch (err) {
    console.error("semantic-search error:", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
