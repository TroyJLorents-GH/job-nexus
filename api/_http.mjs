// Shared HTTP helpers — CORS allowlist + method/OPTIONS boilerplate
const DEFAULT_ORIGINS = [
  "https://job-nexus-delta.vercel.app",
  "http://localhost:5173",
];

function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

/**
 * Apply CORS headers and handle OPTIONS/method gating.
 * Returns true if the request was fully handled (caller should return).
 */
export function handleCors(req, res, methods = ["POST"]) {
  const origin = req.headers?.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  return false;
}

/** Generic auth failure response — no internal details leak to the client. */
export function sendAuthError(res, authError) {
  console.error("auth error:", authError);
  return res.status(authError.status || 401).json({ error: "Unauthorized" });
}
