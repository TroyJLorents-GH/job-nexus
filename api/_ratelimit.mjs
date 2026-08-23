// Fixed-window rate limiting backed by Supabase (no extra service)
import { supabase } from "./_supabase.mjs";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Requests per hour per user, per route
export const LIMITS = {
  "match-job": 20,
  "extract-job": 20,
  "tailor-resume": 10,
  analyze: 10,
  "search-jobs": 60,
  "ats-jobs": 60,
  "semantic-search": 60,
};

/**
 * Returns true when the request is allowed; sends a 429 and returns false otherwise.
 * Fails open on infrastructure errors (rate limiting must never take the app down).
 */
export async function checkRateLimit(res, userId, route) {
  const limit = LIMITS[route];
  if (!limit) return true;

  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();

  try {
    const { data: count, error } = await supabase().rpc("bump_rate_limit", {
      p_user_id: userId,
      p_route: route,
      p_window_start: windowStart,
    });
    if (error) throw new Error(error.message);

    if (count > limit) {
      res.status(429).json({ error: "Rate limit exceeded. Try again later." });
      return false;
    }
    // Opportunistic cleanup ~1% of requests
    if (Math.random() < 0.01) {
      supabase().rpc("prune_rate_limits").then(() => {}, () => {});
    }
    return true;
  } catch (err) {
    console.error("rate limit check failed (failing open):", err);
    return true;
  }
}
