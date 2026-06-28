# Job Nexus — Free/Cheap Stack (Post-Azure)

Target: move off Azure (VM + Cosmos + AI Search) → serverless free/cheap stack for public launch.
**Fixed cost: $25/mo** (Supabase Pro) vs Azure ~$130–200/mo. Everything else free tier.

---

## Architecture + data flow

```mermaid
flowchart TD
    subgraph client["🌐 Client"]
        UI["Web App<br/>job-nexus-delta.vercel.app"]
    end

    subgraph vercel["▲ Vercel — Compute (free Hobby / $20 Pro)"]
        FN["Serverless Functions<br/>api/v2/*.mjs"]
        CRON["Vercel Cron<br/>(watchlist digests)"]
    end

    subgraph auth["🔐 Auth"]
        FB["Firebase Auth<br/>(50k MAU free)"]
    end

    subgraph data["🗄️ Supabase Pro — $25/mo"]
        PG[("Postgres<br/>documents + chunks")]
        VEC["pgvector + tsvector<br/>hybrid_search RRF"]
        STORE["Storage<br/>raw PDFs (1GB)"]
    end

    subgraph ai["🤖 AI Services"]
        EMB["OpenAI<br/>text-embedding-3-small<br/>(~$0/mo)"]
        LP["LlamaParse<br/>(1k pages/day free)"]
        VIS["GPT-4o-mini vision<br/>(scanned-PDF fallback)"]
    end

    subgraph ext["📧 Ops"]
        RESEND["Resend<br/>(3k emails/mo free)"]
        SENTRY["Sentry<br/>(5k errors/mo free)"]
        ATS["ATS sources<br/>Greenhouse / Lever / Ashby"]
    end

    UI -->|ID token| FB
    UI -->|HTTPS| FN
    FN -->|verify token| FB

    FN -->|upload PDF| LP
    LP -->|markdown| FN
    LP -.->|low text| VIS
    VIS -.->|OCR markdown| FN
    FN -->|chunk text| EMB
    EMB -->|vectors| FN

    FN -->|insert rows| PG
    FN -->|store file| STORE
    PG --- VEC

    FN -->|"embed JD → hybrid_search()"| VEC
    VEC -->|ranked resumes| FN
    FN -->|match + why| UI

    CRON -->|query saved searches| PG
    CRON -->|send digest| RESEND
    FN -->|pull jobs| ATS
    FN -.->|errors| SENTRY

    classDef paid fill:#1f6feb,color:#fff,stroke:#1f6feb
    classDef free fill:#238636,color:#fff,stroke:#238636
    class PG,VEC,STORE paid
    class FN,CRON,FB,EMB,LP,VIS,RESEND,SENTRY,ATS free
```

🟦 = the one fixed cost (Supabase Pro, $25/mo) 🟩 = free tier

---

## Cost table

| Need | Pick | Free tier | When you pay |
|:---|:---|:---|:---|
| Compute / API | **Vercel** | 100GB-hr, 100k calls/mo | Pro $20 past traffic |
| DB + vectors | **Supabase** | 500MB, pauses 7d idle | **Pro $25/mo** (no pause) |
| Embeddings | **OpenAI `text-embedding-3-small`** | — | ~$0.02/1M tokens (≈$0/mo) |
| PDF parse | **LlamaParse** | 1k pages/day | past 1k/day |
| Parse fallback | **GPT-4o-mini vision** | — | pennies per scanned PDF |
| Auth | **Firebase Auth** | 50k MAU | rarely hit |
| File storage | **Supabase Storage** | 1GB | in Pro |
| Email | **Resend** | 3k/mo, 100/day | past that |
| Cron | **Vercel Cron** | free any plan | — |
| Monitoring | **Sentry** | 5k errors/mo | past that |
| Domain | Namecheap / Cloudflare | — | ~$10/yr |

---

## Two launch paths

```mermaid
flowchart LR
    START["Launch job-nexus"] --> Q{Budget now?}
    Q -->|"$0 — demo only"| FREE["Supabase Free + Vercel Hobby<br/>+ Firebase + LlamaParse + OpenAI"]
    Q -->|"public-grade"| PRO["Supabase Pro $25<br/>+ rest free tier"]
    FREE --> WARN["⚠️ Supabase pauses<br/>after 7d idle — site dies"]
    PRO --> GOOD["✅ No pause, backups,<br/>8GB, scales — $25/mo flat"]

    classDef warn fill:#9e6a03,color:#fff
    classDef good fill:#238636,color:#fff
    class WARN warn
    class GOOD good
```

**Alt for true $0 no-pause:** swap Supabase → **Neon** (free Postgres + pgvector, no pause), wire Supabase Storage or Vercel Blob separately for files. More glue, $0. Upgrade to Supabase Pro when ready.

---

## Replaces (Azure → here)

| Azure (old) | Free/cheap (new) |
|:---|:---|
| VM Flask `app.py` | Vercel Functions |
| Cosmos DB | Supabase Postgres |
| AI Search (~$75/mo) | pgvector + RRF (in Postgres) |
| Document Intelligence | LlamaParse + GPT-4o-mini |
| Container Registry | gone |
