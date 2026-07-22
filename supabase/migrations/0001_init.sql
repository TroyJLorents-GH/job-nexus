-- Job Nexus: documents + chunks + hybrid (BM25 + vector RRF) search
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
  user_id text not null,                 -- denormalized for per-user filtering
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

-- Reciprocal Rank Fusion over BM25 + cosine similarity
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
