// Vercel Serverless Function — proxies job matching to VM API
import { verifyToken } from "./_auth.mjs";

const VM_API = process.env.VM_API_URL || "http://52.233.82.247:5000";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await verifyToken(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  try {
    const body = req.body || {};
    body.userId = auth.userId;

    const response = await fetch(`${VM_API}/match-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(502).json({ error: "VM API is unreachable", details: err.message });
  }
}
