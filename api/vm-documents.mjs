// Vercel Serverless Function — proxies document CRUD to VM API
import { verifyToken } from "./_auth.mjs";

const VM_API = process.env.VM_API_URL || "http://52.233.82.247:5000";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  const auth = await verifyToken(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  try {
    // Extract document ID from query param
    const documentId = req.query.id || null;

    if (req.method === "DELETE" && documentId) {
      const response = await fetch(`${VM_API}/documents/${documentId}?userId=${auth.userId}`, { method: "DELETE" });
      const data = await response.text();
      return res.status(response.status).send(data);
    }

    if (req.method === "GET" && documentId) {
      const response = await fetch(`${VM_API}/documents/${documentId}?userId=${auth.userId}`);
      const data = await response.text();
      return res.status(response.status).send(data);
    }

    // GET all documents
    const response = await fetch(`${VM_API}/documents?userId=${auth.userId}`);
    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(502).json({ error: "VM API is unreachable", details: err.message });
  }
}
