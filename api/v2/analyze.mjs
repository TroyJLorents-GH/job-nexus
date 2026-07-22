// v2 — resume upload: parse (LlamaParse → GPT-4o-mini vision fallback) → chunk → embed → store
import OpenAI from "openai";
import { verifyToken } from "../_auth.mjs";
import { handleCors, sendAuthError } from "../_http.mjs";
import { supabase } from "../_supabase.mjs";
import { llamaparseToMarkdown, LowTextError } from "../_llamaparse.mjs";
import { chunkMarkdown } from "../_chunk.mjs";
import { embedBatch } from "../_embed.mjs";
import { readMultipartFile } from "../_multipart.mjs";
import { checkRateLimit } from "../_ratelimit.mjs";

export const config = { api: { bodyParser: false } };

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

async function gpt4oVisionMarkdown(fileBytes, filename) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: `data:application/pdf;base64,${Buffer.from(fileBytes).toString("base64")}`,
          },
          {
            type: "input_text",
            text: "Extract ALL text from this document as clean markdown. Preserve section headings, bullet points, and structure. Output only the markdown.",
          },
        ],
      },
    ],
  });
  return resp.output_text || "";
}

async function parseFile(fileBytes, filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  // Plain text needs no parser
  if (ext === "txt" || ext === "md") {
    return { markdown: fileBytes.toString("utf8"), pageCount: null, parser: "plaintext" };
  }

  try {
    const { markdown, pageCount } = await llamaparseToMarkdown(fileBytes, filename);
    return { markdown, pageCount, parser: "llamaparse" };
  } catch (err) {
    // Scanned/image PDFs: fall back to GPT-4o-mini vision
    if (err instanceof LowTextError && ext === "pdf") {
      const markdown = await gpt4oVisionMarkdown(fileBytes, filename);
      if (markdown.trim().length < 50) throw new Error("Could not extract text from document");
      return { markdown, pageCount: null, parser: "gpt4o-vision" };
    }
    throw err;
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "analyze"))) return;

  try {
    const file = await readMultipartFile(req);
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (file.fileBytes.length > MAX_FILE_BYTES) {
      return res.status(413).json({ error: "File too large (max 10 MB)" });
    }

    const { markdown, pageCount, parser } = await parseFile(file.fileBytes, file.filename);

    const chunks = chunkMarkdown(markdown);
    if (chunks.length === 0) return res.status(422).json({ error: "Document contains no text" });

    const embeddings = await embedBatch(chunks.map((c) => c.content));

    const { data: doc, error: docError } = await supabase()
      .from("documents")
      .insert({
        user_id: auth.userId,
        filename: file.filename,
        full_text: markdown,
        parser,
        page_count: pageCount,
      })
      .select()
      .single();
    if (docError) throw new Error(`documents insert failed: ${docError.message}`);

    const { error: chunkError } = await supabase()
      .from("chunks")
      .insert(
        chunks.map((c, i) => ({
          document_id: doc.id,
          user_id: auth.userId,
          chunk_index: c.chunkIndex,
          content: c.content,
          embedding: embeddings[i],
        }))
      );
    if (chunkError) throw new Error(`chunks insert failed: ${chunkError.message}`);

    // Keep the raw file for future re-parsing (best-effort, non-fatal)
    try {
      await supabase()
        .storage.from("resumes")
        .upload(`${auth.userId}/${doc.id}/${file.filename}`, file.fileBytes, {
          contentType: req.headers["content-type"]?.includes("pdf")
            ? "application/pdf"
            : "application/octet-stream",
          upsert: true,
        });
    } catch (storageErr) {
      console.error("storage upload failed (non-fatal):", storageErr);
    }

    return res.status(200).json({
      documentId: doc.id,
      filename: file.filename,
      chunks: chunks.length,
      parser,
    });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "Failed to analyze document" });
  }
}
