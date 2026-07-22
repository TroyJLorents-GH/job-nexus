# job-nexus

Combined job-search app: TanStack frontend (patterns borrowed from tanstack-job-tracker) + resume-matching backend (patterns from openai-mll). Firebase Auth (Google sign-in), hosted on Vercel. Sibling projects tanstack-job-tracker and openai-mll are LIVE; read from them for patterns but never modify them.

## THE STANDING GOAL (do not lose this across compactions; it was re-derived 5 times)

Migrate off Azure so the app can be hosted publicly and cheaply:
- Replace: docker-vm VM (Flask API) + Cosmos DB + Azure AI Search + Doc Intelligence
- With: Supabase pgvector (+ RRF hybrid search), LlamaParse for document parsing, GPT-4o vision where needed
Until that lands, the live site requires a manual ritual: start docker-vm in Azure Portal → ssh in → `cd ~/doc-intelligence-api && source venv/bin/activate && nohup python3 app.py > api.log 2>&1 &`. The VM auto-shuts down on schedule.

## Current architecture (answer before re-deriving; this was re-asked 4 times)

Search/matching runs on Azure AI Search (index `resumes-index`, indexer syncs from Cosmos every 5 min) via the VM's Flask API (`/match-job`, `/semantic-search`; `/match-job` expects camelCase `{"jobDescription": ...}`). Firebase handles auth + per-user isolation (userId filtering). Vercel serves the frontend and API routes.

## Gotchas

- Firebase service-account key: keep in `.env` / Vercel env vars, mind the newline escaping in FIREBASE_PRIVATE_KEY (quoting/return characters broke it before). Never paste the key into chat.
- `.env` is the real file; `.env.example` is the template. Both exist and have been confused.
- Firebase auth/unauthorized-domain: every new Vercel domain must be added to Firebase authorized domains.
- extract-job and search-jobs Vercel functions have failed with CORS and missing-export errors after pushes; after any backend-route change, verify with a real request against prod, not just the build passing.
- Verify loop: `npx tsc --noEmit` before commit.
- Hosting: Vercel (Netlify credits are nearly gone; do not deploy new things to Netlify).
- Troy decides when to commit and push.
