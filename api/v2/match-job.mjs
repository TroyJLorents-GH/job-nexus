// v2 — job matching: JD requirement extraction → hybrid RRF search → LLM skill-gap
// analysis per resume → blended confidence + recommendation.
// Response contract must match MatchResult/MatchResponse in src/components/ResumePipeline.tsx.
import { verifyToken } from "../_auth.mjs";
import { handleCors, sendAuthError } from "../_http.mjs";
import { supabase } from "../_supabase.mjs";
import { embedBatch } from "../_embed.mjs";
import { checkRateLimit } from "../_ratelimit.mjs";
import { llm, MODELS } from "../_llm.mjs";

const MAX_JD_CHARS = 20000;
const TOP_DOCS = 5;

async function jsonCall(system, user) {
  const resp = await llm().chat.completions.create({
    model: MODELS.fast,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(resp.choices[0].message.content);
}

async function extractRequirements(jobDescription) {
  const out = await jsonCall(
    'Extract the concrete requirements from a job description. Return JSON: {"requirements": string[]} — each entry a short skill, technology, qualification, or experience requirement (e.g. "Python", "5+ years backend", "AWS"). Max 20 entries, most important first.',
    jobDescription
  );
  return Array.isArray(out.requirements) ? out.requirements.slice(0, 20) : [];
}

async function analyzeResume(requirements, resumeText, jobDescription) {
  const out = await jsonCall(
    'You compare a resume against job requirements. Be evidence-based: a skill is "matched" only if the resume shows it explicitly or through clearly equivalent experience. Return JSON: {"matchedSkills": string[], "missingSkills": string[], "resumeKeyPhrases": string[]} — matchedSkills/missingSkills partition the given requirements; resumeKeyPhrases are up to 8 standout phrases from the resume relevant to this job.',
    `REQUIREMENTS:\n${requirements.join("\n")}\n\nJOB DESCRIPTION (context):\n${jobDescription.slice(0, 4000)}\n\nRESUME:\n${resumeText.slice(0, 24000)}`
  );
  return {
    matchedSkills: Array.isArray(out.matchedSkills) ? out.matchedSkills : [],
    missingSkills: Array.isArray(out.missingSkills) ? out.missingSkills : [],
    resumeKeyPhrases: Array.isArray(out.resumeKeyPhrases) ? out.resumeKeyPhrases : [],
  };
}

function aggregateByDocument(hits) {
  const byDoc = new Map();
  for (const hit of hits) {
    const entry = byDoc.get(hit.document_id) || { scores: [] };
    entry.scores.push(hit.score);
    byDoc.set(hit.document_id, entry);
  }
  // Blend best-chunk relevance with breadth of coverage
  return [...byDoc.entries()]
    .map(([documentId, { scores }]) => {
      const max = Math.max(...scores);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { documentId, searchScore: 0.7 * max + 0.3 * mean };
    })
    .sort((a, b) => b.searchScore - a.searchScore);
}

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "match-job"))) return;

  const jobDescription = (req.body?.jobDescription || "").slice(0, MAX_JD_CHARS);
  if (!jobDescription.trim()) return res.status(400).json({ error: "Missing jobDescription" });

  try {
    // 1. Requirements + JD embedding in parallel
    const [jobRequirements, [jdEmbedding]] = await Promise.all([
      extractRequirements(jobDescription),
      embedBatch([jobDescription]),
    ]);

    // 2. Hybrid BM25+vector RRF retrieval
    const { data: hits, error: rpcError } = await supabase().rpc("hybrid_search", {
      p_user_id: auth.userId,
      p_query_text: jobDescription,
      p_query_embedding: jdEmbedding,
      p_match_count: 40,
    });
    if (rpcError) throw new Error(`hybrid_search failed: ${rpcError.message}`);
    if (!hits || hits.length === 0) {
      return res.status(200).json({
        matches: [],
        recommendation: "No resumes found. Upload a resume first.",
        jobRequirements,
      });
    }

    // 3. Aggregate to documents, fetch top-N full texts
    const ranked = aggregateByDocument(hits).slice(0, TOP_DOCS);
    const { data: docs, error: docsError } = await supabase()
      .from("documents")
      .select("id, filename, full_text")
      .in("id", ranked.map((r) => r.documentId))
      .eq("user_id", auth.userId);
    if (docsError) throw new Error(docsError.message);
    const docById = new Map((docs || []).map((d) => [d.id, d]));

    // 4. LLM skill-gap analysis per document (parallel)
    const maxSearch = Math.max(...ranked.map((r) => r.searchScore));
    const matches = await Promise.all(
      ranked
        .filter((r) => docById.has(r.documentId))
        .map(async (r) => {
          const doc = docById.get(r.documentId);
          const gap = await analyzeResume(jobRequirements, doc.full_text, jobDescription);
          const total = gap.matchedSkills.length + gap.missingSkills.length;
          const skillMatchPercent = total > 0
            ? Math.round((gap.matchedSkills.length / total) * 100)
            : 0;
          // Confidence blends LLM-verified skill coverage (dominant) with retrieval strength
          const normSearch = maxSearch > 0 ? r.searchScore / maxSearch : 0;
          const confidence = Math.round(0.65 * skillMatchPercent + 0.35 * normSearch * 100);
          return {
            documentId: r.documentId,
            filename: doc.filename,
            confidence,
            skillMatchPercent,
            searchScore: Number(r.searchScore.toFixed(4)),
            ...gap,
          };
        })
    );
    matches.sort((a, b) => b.confidence - a.confidence);

    // 5. Short synthesis across top matches
    let recommendation = "";
    try {
      const summary = matches
        .map((m) => `${m.filename}: ${m.confidence}% (matched: ${m.matchedSkills.slice(0, 6).join(", ")}; gaps: ${m.missingSkills.slice(0, 4).join(", ")})`)
        .join("\n");
      const out = await jsonCall(
        'Given resume-vs-job match results, write a 2-3 sentence recommendation: which resume fits best, why, and the single most impactful gap to address. Return JSON: {"recommendation": string}',
        summary
      );
      recommendation = out.recommendation || "";
    } catch (recErr) {
      console.error("recommendation synthesis failed (non-fatal):", recErr);
    }

    return res.status(200).json({ matches, recommendation, jobRequirements });
  } catch (err) {
    console.error("match-job error:", err);
    return res.status(500).json({ error: "Job matching failed" });
  }
}
