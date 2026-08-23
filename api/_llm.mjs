// Shared LLM client — routes through the ASU AIML gateway (OpenAI-compatible).
// One token, model string picks the provider ("<provider>/<name>").
// Falls back to direct OpenAI if LLM_BASE_URL is unset (legacy).
import OpenAI from "openai";

let client = null;

export function llm() {
  if (client) return client;
  const baseURL = process.env.LLM_BASE_URL || "https://api-main.aiml.asu.edu/v1";
  const apiKey = process.env.LLM_API_KEY || process.env.ASU_AIML_TOKEN || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing LLM_API_KEY (or ASU_AIML_TOKEN)");
  client = new OpenAI({ baseURL, apiKey });
  return client;
}

// Gateway model strings. Exact names matter — variants return empty responses.
export const MODELS = {
  embed: process.env.LLM_EMBED_MODEL || "openai/te3s",          // text-embedding-3-small, 1536d
  fast:  process.env.LLM_FAST_MODEL  || "openai/gpt5_4_mini",   // extraction, skill-gap, vision fallback
  smart: process.env.LLM_SMART_MODEL || "aws/claude5_sonnet",   // fallback for heavier reasoning
};
