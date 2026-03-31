// Vercel Serverless Function — proxies resume upload to VM API /analyze
import { verifyToken } from "./_auth.mjs";

const VM_API = process.env.VM_API_URL || "http://52.233.82.247:5000";

export const config = {
  api: {
    bodyParser: false, // We need raw body for multipart
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await verifyToken(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  try {
    // Collect raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";

    const response = await fetch(`${VM_API}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-User-Id": auth.userId,
      },
      body: bodyBuffer,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: "VM API is unreachable", details: err.message });
  }
}
