// Vercel Serverless Function — proxies JobSpy search to the FastAPI backend
import { verifyToken } from "./_auth.mjs";
import { handleCors, sendAuthError } from "./_http.mjs";
import { checkRateLimit } from "./_ratelimit.mjs";

const JOBSPY_API = process.env.JOBSPY_API_URL || "http://localhost:8000";

// Only forward known JobSpy fields — never proxy an arbitrary body
const ALLOWED_FIELDS = [
  "search_term",
  "location",
  "site_name",
  "results_wanted",
  "hours_old",
  "country_indeed",
  "is_remote",
  "job_type",
  "distance",
];

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "search-jobs"))) return;

  try {
    const raw = req.body || {};
    const body = {};
    for (const field of ALLOWED_FIELDS) {
      if (raw[field] !== undefined) body[field] = raw[field];
    }
    if (body.results_wanted) body.results_wanted = Math.min(Number(body.results_wanted) || 20, 50);

    const response = await fetch(`${JOBSPY_API}/search-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`JobSpy backend error: ${response.status}`);
      return res.status(502).json({ error: "Job search backend unavailable" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("search-jobs proxy error:", err);
    return res.status(502).json({ error: "Failed to reach job search backend" });
  }
}
