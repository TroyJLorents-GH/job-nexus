import OpenAI from "openai";
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
    const { url } = req.body || {};

    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ error: "Valid URL required" });
    }

    // Fetch the page HTML
    const pageResp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

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
    const message = err.name === "TimeoutError" ? "URL took too long to respond" : err.message;
    return res.status(500).json({ error: "Failed to extract job description", detail: message });
  }
}
