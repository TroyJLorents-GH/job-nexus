// v2 — document list / detail / delete backed by Supabase
import { verifyToken } from "../_auth.mjs";
import { handleCors, sendAuthError } from "../_http.mjs";
import { supabase } from "../_supabase.mjs";

export default async function handler(req, res) {
  if (handleCors(req, res, ["GET", "DELETE"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  const id = req.query?.id;

  try {
    if (req.method === "GET" && id) {
      const { data, error } = await supabase()
        .from("documents")
        .select("id, filename, full_text, parser, page_count, uploaded_at")
        .eq("id", id)
        .eq("user_id", auth.userId)
        .single();
      if (error || !data) return res.status(404).json({ error: "Document not found" });
      return res.status(200).json({
        id: data.id,
        filename: data.filename,
        fullText: data.full_text,
        parser: data.parser,
        pageCount: data.page_count,
        uploadedAt: data.uploaded_at,
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase()
        .from("documents")
        .select("id, filename, page_count, uploaded_at")
        .eq("user_id", auth.userId)
        .order("uploaded_at", { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({
        documents: (data || []).map((d) => ({
          id: d.id,
          filename: d.filename,
          pageCount: d.page_count,
          uploadedAt: d.uploaded_at,
        })),
      });
    }

    // DELETE
    if (!id) return res.status(400).json({ error: "Missing id" });

    const { data: doc } = await supabase()
      .from("documents")
      .select("id, filename")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single();
    if (!doc) return res.status(404).json({ error: "Document not found" });

    // chunks cascade via FK; storage cleanup is best-effort
    const { error: delError } = await supabase()
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.userId);
    if (delError) throw new Error(delError.message);

    try {
      await supabase()
        .storage.from("resumes")
        .remove([`${auth.userId}/${id}/${doc.filename}`]);
    } catch (storageErr) {
      console.error("storage delete failed (non-fatal):", storageErr);
    }

    return res.status(200).json({ deleted: id });
  } catch (err) {
    console.error("documents error:", err);
    return res.status(500).json({ error: "Document operation failed" });
  }
}
