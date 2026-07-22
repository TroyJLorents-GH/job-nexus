import { initFirebase, verifyToken } from "./_auth.mjs";
import { handleCors, sendAuthError } from "./_http.mjs";
import { checkRateLimit } from "./_ratelimit.mjs";

initFirebase();

const MAX_TEXT_CHARS = 20000;

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

    // Call ResumeAgent via Azure Foundry
    const { ClientSecretCredential } = await import("@azure/identity");

    const credential = new ClientSecretCredential(
      process.env.RESUME_AGENT_TENANT_ID,
      process.env.RESUME_AGENT_CLIENT_ID,
      process.env.RESUME_AGENT_CLIENT_SECRET
    );

    const token = await credential.getToken("https://ai.azure.com/.default");

    const prompt =
      `TAILOR MODE\n\n` +
      `Job Description:\n${jobDescription}\n\n` +
      `My Resume:\n${resumeText}\n\n` +
      `Matched Skills: ${matchedSkills.join(", ")}\n` +
      `Missing/Weak Skills: ${missingSkills.join(", ")}\n\n` +
      `Give me your top 3-5 highest-impact changes to tailor this resume for this job.`;

    const resp = await fetch(process.env.RESUME_AGENT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({ input: [{ role: "user", content: prompt }] }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`ResumeAgent returned ${resp.status}: ${errText}`);
    }

    const data = await resp.json();

    // Extract response (multiple format support)
    let suggestions = "";
    if (data.output_text) {
      suggestions = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && item.role === "assistant") {
          const content = item.content || [];
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c.type === "output_text" && c.text) {
                suggestions = c.text;
                break;
              }
            }
          } else {
            suggestions = String(content);
          }
          break;
        }
      }
    } else if (data.choices?.[0]?.message?.content) {
      suggestions = data.choices[0].message.content;
    }

    if (!suggestions) {
      suggestions = "ResumeAgent did not return a response. Please try again.";
    }

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error("Tailor error:", err);
    return res.status(500).json({ error: "Resume tailoring failed" });
  }
}
