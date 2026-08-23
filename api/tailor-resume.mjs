// Resume tailoring — rewrites nothing, returns prioritized suggestions.
// Runs on the LLM gateway (was Azure Foundry ResumeAgent).
import { initFirebase, verifyToken } from "./_auth.mjs";
import { handleCors, sendAuthError } from "./_http.mjs";
import { checkRateLimit } from "./_ratelimit.mjs";
import { llm, MODELS } from "./_llm.mjs";

initFirebase();

const MAX_TEXT_CHARS = 20000;

const SYSTEM_PROMPT = `You are an expert resume coach. Given a resume, a target job description, and a skill-gap analysis, return the highest-impact edits that would make this resume win an interview for THIS job.

Rules:
- Be specific. Quote the exact resume line to change and give the replacement wording.
- Mirror terminology from the job description so the resume survives keyword screens.
- Never invent experience, employers, dates, or credentials the resume does not support. For genuine gaps, suggest how to surface adjacent/transferable experience the candidate actually has, or say to leave it alone.
- Prioritize: highest impact first. 3-5 changes, not a rewrite.

Return markdown: a numbered list. Each item = a bold one-line summary, then "Current:" and "Suggested:" lines, then one sentence of why it matters for this job.`;

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "tailor-resume"))) return;

  try {
    const body = req.body || {};
    const resumeText = (body.resumeText || "").toString().slice(0, MAX_TEXT_CHARS);
    const jobDescription = (body.jobDescription || "").toString().slice(0, MAX_TEXT_CHARS);
    const matchedSkills = Array.isArray(body.matchedSkills) ? body.matchedSkills : [];
    const missingSkills = Array.isArray(body.missingSkills) ? body.missingSkills : [];

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: "resumeText and jobDescription are required" });
    }

    const userPrompt =
      `JOB DESCRIPTION:\n${jobDescription}\n\n` +
      `RESUME:\n${resumeText}\n\n` +
      `Already demonstrated: ${matchedSkills.join(", ") || "(none identified)"}\n` +
      `Missing or weak: ${missingSkills.join(", ") || "(none identified)"}\n\n` +
      `Give the top 3-5 highest-impact changes.`;

    const resp = await llm().chat.completions.create({
      model: MODELS.smart,
      temperature: 0.4,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const suggestions = resp.choices?.[0]?.message?.content?.trim();
    if (!suggestions) {
      return res.status(502).json({ error: "No suggestions generated. Please try again." });
    }

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error("Tailor error:", err);
    return res.status(500).json({ error: "Resume tailoring failed" });
  }
}
