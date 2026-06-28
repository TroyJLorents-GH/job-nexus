---
project: projects/job-nexus
type: services
---

# Hosted Services — Job Nexus

External hosted/cloud services this project depends on, detected from configuration, SDKs, and environment variables (`.env.example`, `package.json`, `api/*.mjs`, `vercel.json`, `MIGRATION.md`).

## Vercel
- **Role:** Hosting for the SPA and the serverless functions under `api/` (Node `.mjs`).
- **Evidence:** `vercel.json` (`framework: vite`, `/api/*` rewrites + SPA fallback). Server-side env vars are set in the Vercel project dashboard.

## Firebase (Google Cloud)
- **Role:** Authentication (Google sign-in) and Firestore database (tracked applications at `users/{uid}/applications`).
- **Evidence:** `firebase` client SDK + `firebase-admin` (`api/_auth.mjs`); `VITE_FIREBASE_*` client config and `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` admin credentials.

## OpenAI
- **Role:** Chat completions (streaming SSE), job-description extraction (GPT-4.1-mini), and content moderation.
- **Evidence:** `openai` package; `OPENAI_API_KEY`; usage in `api/chat.mjs` and `api/extract-job.mjs`.

## Azure AI Foundry (Microsoft Azure)
- **Role:** Two managed agents — `PersonalAssistant` (chat) and `ResumeAgent` (resume tailoring), accessed via OpenAI-protocol responses endpoints with Azure AD client-credential auth.
- **Evidence:** `@azure/identity` (`ClientSecretCredential`); `AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET` + `FOUNDRY_AGENT_ENDPOINT`; `RESUME_AGENT_*` vars + `RESUME_AGENT_ENDPOINT`; usage in `api/chat.mjs` and `api/tailor-resume.mjs`.

## VM API (self-hosted backend)
- **Role:** Resume upload/parse, document listing/retrieval/deletion, and hybrid-search job matching.
- **Evidence:** `VM_API` / `VM_API_URL`; proxied by `api/vm-analyze.mjs`, `api/vm-documents.mjs`, `api/vm-match-job.mjs`. Per `MIGRATION.md`, this is backed by an Azure VM with Cosmos DB, Azure AI Search, and Document Intelligence.

## JobSpy backend (self-hosted FastAPI)
- **Role:** Aggregator job search (LinkedIn, Indeed, Google).
- **Evidence:** `JOBSPY_API_URL` (server) / `VITE_JOBSPY_API_URL` (optional local dev); proxied by `api/search-jobs.mjs`.

## ATS public APIs (Greenhouse, Lever, Ashby)
- **Role:** Fetch company job boards directly by company slug (no auth, no scraping).
- **Evidence:** `api/ats-jobs.mjs`.

## Planned (not yet active) — see `MIGRATION.md`
- **Supabase** — Postgres + pgvector to replace the VM/Cosmos/AI-Search stack. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **LlamaCloud (LlamaParse)** — document parsing. Env: `LLAMA_CLOUD_API_KEY`.
