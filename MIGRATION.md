# Job Nexus Migration: Off Azure VM Stack

**Goal:** Replace Azure VM + Cosmos DB + AI Search + Document Intelligence + Container Registry with **Supabase pgvector + LlamaParse + OpenAI** — all serverless, no VM, no container.

**Big win:** Every current `/api/vm-*` endpoint becomes a pure Vercel Function calling HTTP APIs. No more VM auto-shutdowns, no more SSH, no Python required.

---

## What's being replaced

| Current (Azure)                       | Replacement                                   | Notes |
|:--------------------------------------|:----------------------------------------------|:------|
| VM (`docker-vm-free` Flask `app.py`)  | Vercel Functions (`api/v2/*.mjs`)             | All endpoints become Node serverless |
| Cosmos DB (`resumes` container)       | Supabase Postgres `documents` + `chunks`      | Same data, queryable SQL |
| Azure AI Search (`resumes-index`)     | Supabase pgvector + tsvector + RRF SQL fn     | Hybrid BM25+vector in-DB |
| Document Intelligence                 | LlamaParse (primary) + GPT-4o vision (fallback) | Markdown output, plug-and-play |
| Container Registry (ACR)              | Gone — no container needed                    | — |
| Cosmos→Search indexer (5-min sync)    | Direct insert during `/analyze`               | Real-time, no lag |

**Staying on Azure:** Foundry agents (PersonalAssistant, ResumeAgent, ResumeMatcherAgent) — those are unrelated to this stack.

---

## Phase 0 — Lock-in decisions (15 min, no code)

| Decision                | Choice                                       | Reason |
|:------------------------|:---------------------------------------------|:-------|
| Hybrid search backend   | **Supabase pgvector + RRF**                  | SQL we own, $25/mo Pro covers 8GB, Troy already uses Supabase elsewhere |
| Embedding model         | **OpenAI `text-embedding-3-small`** (1536d)  | $0.02/1M tokens, same dim as ada-002 — schema-compatible if we ever switched back |
| Doc parser primary      | **LlamaParse** (free 1k pages/day)           | Returns clean markdown, handles tables, images, multi-column |
| Doc parser fallback     | **GPT-4o vision** for scanned/image PDFs     | When LlamaParse confidence is low |
| Auth                    | Keep Firebase ID-token verify in `_auth.mjs` | No frontend change |
| RLS strategy            | Service role key from Vercel; `userId` filter in every query | Firebase already authenticated upstream |

**Cost rough math:** Supabase Pro $25/mo + LlamaParse free tier (Troy's volume) + OpenAI embeddings (~$0/mo at this scale) = **~$25/mo** vs. current Azure stack ~$80–150/mo.

---

## Phase 1 — Stand up Supabase (1.5 hr)

### Tasks
- [ ] Create Supabase project `job-nexus-prod`, region close to Vercel deployment
- [ ] Enable extensions: `vector`, `pg_trgm`
- [ ] Run schema migration (below)
- [ ] Create RRF SQL function (below)
- [ ] Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to Vercel env
- [ ] Add `LLAMA_CLOUD_API_KEY` to Vercel env
- [ ] Smoke test: insert 1 row, run hybrid search, confirm score format

### Schema (`supabase/migrations/0001_init.sql`)
```sql
create extension if not exists vector;
create extension if not exists pg_trgm;

-- One row per uploaded resume/document
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- Firebase uid
  filename text not null,
  full_text text not null,
  parser text not null,                  -- 'llamaparse' | 'gpt4o-vision'
  page_count int,
  uploaded_at timestamptz default now()
);
create index documents_user_id_idx on documents(user_id);

-- Chunks for semantic search
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id text not null,                 -- denormalized for RLS
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  search_vector tsvector
    generated always as (to_tsvector('english', content)) stored
);
create index chunks_user_id_idx on chunks(user_id);
create index chunks_embedding_idx on chunks
  using hnsw (embedding vector_cosine_ops);
create index chunks_search_idx on chunks using gin(search_vector);
```

### RRF function
```sql
create or replace function hybrid_search(
  p_user_id text,
  p_query_text text,
  p_query_embedding vector(1536),
  p_match_count int default 20,
  p_rrf_k int default 60
)
returns table (
  document_id uuid,
  chunk_id uuid,
  content text,
  score float
)
language sql stable
as $$
  with bm25 as (
    select id, document_id, content,
           row_number() over (order by ts_rank_cd(search_vector, q) desc) as rank_pos
    from chunks, plainto_tsquery('english', p_query_text) q
    where user_id = p_user_id and search_vector @@ q
    limit 50
  ),
  vec as (
    select id, document_id, content,
           row_number() over (order by embedding <=> p_query_embedding) as rank_pos
    from chunks
    where user_id = p_user_id
    order by embedding <=> p_query_embedding
    limit 50
  ),
  fused as (
    select coalesce(b.id, v.id) as chunk_id,
           coalesce(b.document_id, v.document_id) as document_id,
           coalesce(b.content, v.content) as content,
           coalesce(1.0 / (p_rrf_k + b.rank_pos), 0) +
           coalesce(1.0 / (p_rrf_k + v.rank_pos), 0) as score
    from bm25 b full outer join vec v on b.id = v.id
  )
  select document_id, chunk_id, content, score
  from fused
  order by score desc
  limit p_match_count;
$$;
```

---

## Phase 2 — New Vercel endpoints (3 hr)

Build the v2 endpoints alongside the existing `vm-*` ones. Frontend keeps calling the old paths until Phase 4.

### New files

| File                              | Replaces                | What it does |
|:----------------------------------|:------------------------|:-------------|
| `api/v2/analyze.mjs`              | `vm-analyze.mjs`        | Multipart upload → LlamaParse → chunk → embed → insert |
| `api/v2/documents.mjs`            | `vm-documents.mjs`      | List/get/delete from Supabase |
| `api/v2/match-job.mjs`            | `vm-match-job.mjs`      | Embed JD → call `hybrid_search` RPC → return ranked resumes |
| `api/v2/semantic-search.mjs`      | (VM endpoint)           | Same RRF call, generic query |
| `api/_supabase.mjs`               | (new helper)            | Lazy-initialized supabase service client |
| `api/_llamaparse.mjs`             | (new helper)            | LlamaParse upload → poll → markdown |
| `api/_embed.mjs`                  | (new helper)            | OpenAI `text-embedding-3-small` batched |
| `api/_chunk.mjs`                  | (new helper)            | Markdown → ~500-token chunks with overlap |

### `api/v2/analyze.mjs` outline
```js
import { verifyToken } from "../_auth.mjs";
import { supabase } from "../_supabase.mjs";
import { llamaparseToMarkdown } from "../_llamaparse.mjs";
import { embedBatch } from "../_embed.mjs";
import { chunkMarkdown } from "../_chunk.mjs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS, auth, collect multipart bytes
  const auth = await verifyToken(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const { filename, fileBytes } = await readMultipart(req);
  const markdown = await llamaparseToMarkdown(fileBytes, filename);
  const chunks = chunkMarkdown(markdown);
  const embeddings = await embedBatch(chunks.map(c => c.content));

  const { data: doc } = await supabase().from("documents").insert({
    user_id: auth.userId,
    filename,
    full_text: markdown,
    parser: "llamaparse",
  }).select().single();

  await supabase().from("chunks").insert(
    chunks.map((c, i) => ({
      document_id: doc.id,
      user_id: auth.userId,
      chunk_index: i,
      content: c.content,
      embedding: embeddings[i],
    }))
  );

  return res.status(200).json({ documentId: doc.id, chunks: chunks.length });
}
```

### `api/v2/match-job.mjs` outline
```js
const queryEmbedding = await embedBatch([jobDescription]).then(r => r[0]);

const { data: hits } = await supabase().rpc("hybrid_search", {
  p_user_id: auth.userId,
  p_query_text: jobDescription,
  p_query_embedding: queryEmbedding,
  p_match_count: 20,
});

// Aggregate chunk scores up to documents, return top-N resumes ranked
const byDoc = aggregateByDocument(hits);
return res.status(200).json({ matches: byDoc });
```

### Tasks
- [ ] `api/_supabase.mjs` — service-role client factory
- [ ] `api/_llamaparse.mjs` — POST file, poll job, return markdown
- [ ] `api/_embed.mjs` — OpenAI batched embeddings
- [ ] `api/_chunk.mjs` — markdown chunker with ~500-token windows + 50-token overlap
- [ ] `api/v2/analyze.mjs`
- [ ] `api/v2/documents.mjs`
- [ ] `api/v2/match-job.mjs`
- [ ] `api/v2/semantic-search.mjs`
- [ ] Add fallback path: if LlamaParse returns < 100 chars, retry with GPT-4o vision (page-by-page OCR)
- [ ] Type-check passes (`npm run build`)

---

## Phase 3 — Backfill existing resumes (1 hr)

### Approach
A one-shot script that reads from Cosmos and writes to Supabase. Run once, manually.

### Tasks
- [ ] `scripts/backfill-cosmos-to-supabase.mjs`
  - Query all docs from Cosmos DB `resumes` container
  - For each: extract `fullText` (already parsed) → chunk → embed → insert into Supabase
  - **Skip re-parsing** — Cosmos already has the extracted text from prior DI runs
  - Log per-user counts, fail soft on bad rows
- [ ] Run script in Vercel CLI or locally with prod env
- [ ] Spot-check 3 users: row counts match between Cosmos and Supabase
- [ ] Run a `match-job` on v2 for a known user, compare scores against vm endpoint

---

## Phase 4 — Cut over (30 min)

### Strategy
Server-side switch — keep the `/api/vm-*` URLs (frontend doesn't change), have those files internally call v2.

### Tasks
- [ ] In `api/vm-match-job.mjs`, replace VM proxy with `import handler from './v2/match-job.mjs'; export default handler`
- [ ] Same for `vm-analyze.mjs`, `vm-documents.mjs`
- [ ] Deploy to Vercel preview
- [ ] Smoke test from prod URL with a real Firebase user
- [ ] Watch logs for 24 hours
- [ ] Promote preview → production

### Rollback plan
Each old `vm-*.mjs` is preserved in git. Revert the import line and redeploy → instantly back on VM.

---

## Phase 5 — Decommission Azure (15 min)

**Wait 1 week after Phase 4 in case of latent issues.**

### Tasks
- [ ] Stop the VM (`docker-vm-free`) in Azure Portal
- [ ] Delete VM + disk + NIC + public IP
- [ ] Delete `troy-acr` container registry
- [ ] Delete Cosmos DB account
- [ ] Delete Azure AI Search resource (`troy-ai-search`)
- [ ] Delete Document Intelligence resource
- [ ] **Keep:** Foundry agents on `troy-mj186sow-swedencentral` and `troy-assistant-2026`
- [ ] Update memory: `azure-foundry.md`, `lessons-learned.md`, project README
- [ ] Remove `VM_API_URL` from Vercel env

---

## Open questions for Troy

1. **Resume file storage** — Cosmos stores `fullText` only (no original file). Do you want to also start storing the raw PDFs in Supabase Storage during `/analyze`? Useful for re-parsing later if LlamaParse improves.
2. **Multi-tenancy on Supabase** — single project for all users with `user_id` column (proposed), or separate schemas per user? Single project is simpler and Postgres handles 100k+ rows trivially.
3. **GPT-4o vision fallback threshold** — when do we trigger it? Suggest: LlamaParse markdown < 200 chars OR no detected text. Easy to tune later.
4. **Backfill volume** — roughly how many docs in Cosmos right now? (Affects whether the backfill script needs batching/checkpointing.)

---

## Time estimate

| Phase | Duration |
|:------|:---------|
| 0 — Decisions  | 15 min |
| 1 — Supabase   | 1.5 hr |
| 2 — Endpoints  | 3 hr   |
| 3 — Backfill   | 1 hr   |
| 4 — Cutover    | 30 min |
| 5 — Decom      | 15 min (+ 1 week soak) |
| **Total**      | **~6.5 hr active work, 1 week elapsed** |
