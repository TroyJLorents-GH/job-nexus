import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import OpenAI from "openai";
import { initFirebase, verifyToken } from "./_auth.mjs";
import { handleCors, sendAuthError } from "./_http.mjs";
import { checkRateLimit } from "./_ratelimit.mjs";

initFirebase();

function isPrivateIp(ip) {
  if (ip.includes(":")) {
    // IPv6: loopback, link-local, unique-local, v4-mapped private
    const low = ip.toLowerCase();
    return (
      low === "::1" ||
      low.startsWith("fe80:") ||
      low.startsWith("fc") ||
      low.startsWith("fd") ||
      low.startsWith("::ffff:")
    );
  }
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

/** SSRF guard: only public http(s) URLs on standard ports. */
async function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL";
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return "Only http(s) URLs allowed";
  if (parsed.port && !["80", "443"].includes(parsed.port)) return "Non-standard port not allowed";

  const host = parsed.hostname;
  if (isIP(host)) {
    if (isPrivateIp(host)) return "URL not allowed";
  } else {
    try {
      const { address } = await lookup(host);
      if (isPrivateIp(address)) return "URL not allowed";
    } catch {
      return "Could not resolve URL host";
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "extract-job"))) return;

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Valid URL required" });
    }
    const urlError = await validateUrl(url);
    if (urlError) return res.status(400).json({ error: urlError });

    // Fetch the page HTML — redirects followed manually so every hop is re-validated
    let currentUrl = url;
    let pageResp;
    for (let hop = 0; hop < 4; hop++) {
      pageResp = await fetch(currentUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (pageResp.status < 300 || pageResp.status >= 400) break;
      const location = pageResp.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      const redirectError = await validateUrl(currentUrl);
      if (redirectError) return res.status(400).json({ error: redirectError });
    }

    if (!pageResp.ok) {
      return res.status(502).json({ error: `Failed to fetch URL (${pageResp.status})` });
    }

    const html = await pageResp.text();

    // Strip HTML to raw text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) {
      return res.status(422).json({
        error: "Could not extract meaningful text from this URL. The page may require JavaScript to load.",
      });
    }

    // Use GPT to extract the job description
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a job description extractor. Given raw text from a job posting webpage, " +
            "extract ONLY the job description content: job title, company, location, salary (if listed), " +
            "responsibilities, requirements, qualifications, and benefits. " +
            "Remove all navigation, ads, cookie notices, footer text, and other non-job content. " +
            "Return the clean job description as plain text, preserving the structure with line breaks. " +
            "If the text does not appear to contain a job posting, respond with exactly: NOT_A_JOB_POSTING",
        },
        {
          role: "user",
          content: text.slice(0, 12000),
        },
      ],
      temperature: 0,
      max_completion_tokens: 2000,
    });

    const extracted = response.choices[0].message.content.trim();

    if (extracted === "NOT_A_JOB_POSTING") {
      return res.status(422).json({ error: "This URL doesn't appear to contain a job posting." });
    }

    return res.status(200).json({ jobDescription: extracted });
  } catch (err) {
    console.error("Extract job error:", err);
    const message =
      err.name === "TimeoutError"
        ? "URL took too long to respond"
        : "Failed to extract job description";
    return res.status(500).json({ error: message });
  }
}
