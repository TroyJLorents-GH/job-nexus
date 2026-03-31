import { initFirebase, verifyToken } from "./_auth.mjs";

initFirebase();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await verifyToken(req);
  if (auth.error) return res.status(401).json({ error: auth.error });

  try {
    const { resumeText, jobDescription, matchedSkills = [], missingSkills = [] } = req.body || {};

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
    return res.status(500).json({ error: err.message });
  }
}
