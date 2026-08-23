# Next Steps — Post-Migration Checklist

Status as of 2026-08-20: **Migration verified working in production.** Supabase live
(`job-nexus-prod`, us-east-1), RLS enabled, real resume uploaded and indexed.
All LLM calls now route through the ASU AIML gateway (`LLM_API_KEY`), not OpenAI direct.
**Azure VM no longer receives traffic.**

Verified end to end: upload "Lorents Troy - Resume.pdf" (2 pages) -> LlamaParse ->
5 chunks -> 5 embeddings (1536d via gateway) -> stored in Supabase. hybrid_search
RRF ranks the TECHNICAL SKILLS chunk ~2x above others for a full-stack JD, which is
correct fusion behavior (it hits both the BM25 and vector lists).

---

## 1. Verify the deploy (do first, ~15 min)

- [x] Vercel dashboard → job-nexus → confirm the deployment from this push succeeded
- [x] Open https://job-nexus-delta.vercel.app, sign in
- [x] **Upload a resume** (Resume Pipeline) → should parse via LlamaParse and list the doc
- [x] **Match** pipeline verified (RRF ranking correct on real resume); still worth one browser run
- [ ] **Match** against a real job description → expect new response: confidence %, skill match %, matched/missing skill chips, recommendation text
- [ ] **Tailor** one result → still works (Azure Foundry ResumeAgent, unchanged)
- [ ] **Discover** → search requires login now; ATS search works; extract-from-URL works
- [x] Check Supabase dashboard → Table Editor → `documents` + `chunks` have rows after upload

## 2. Security probes (~10 min)

- [x] `curl -X POST https://job-nexus-delta.vercel.app/api/search-jobs` (no token) → expect **401**
- [x] Burst any endpoint past its hourly limit → expect **429**
- [x] `POST /api/extract-job` with `{"url":"http://169.254.169.254/"}` (with token) → expect **400** rejected
- [x] Request from a foreign origin → no CORS allow header

## 3. Known issues to resolve

- [ ] **JobSpy backend** — `api/search-jobs.mjs` proxies to `JOBSPY_API_URL`. If that pointed at the Azure VM, aggregator search (LinkedIn/Indeed/Google) is dead now. Check where it points. Options: host JobSpy on Fly.io/Render (~$5/mo), or drop aggregator search (ATS + URL-extract still work).
- [ ] **Scanned-PDF fallback untested** — vision path in `api/v2/analyze.mjs` has not run against a real scanned PDF. Test with one.
- [ ] **Gateway quirks** (documented in `api/_embed.mjs`): `/v1/embeddings` silently returns EMPTY vectors for array input, so we send one string per request (8 concurrent). SDK default base64 encoding also returns empty; `encoding_format: "float"` is forced. Model strings must be exact: `openai/te3s` works, `openai/text-embedding-3-small` returns empty.
- [ ] **Gateway tool-payload limit** — ASU gateway hangs past 180s with no error at ~12+ tools. Cap any future agent loop at 8-9 tools.
- [ ] **Rate limit numbers are guesses** — match 20/hr, analyze 10/hr, extract 20/hr etc. (`api/_ratelimit.mjs`). Tune after real usage.

## 4. Cleanup (after 1 week stable — target ~2026-08-27)

- [ ] Azure Portal: **delete** docker-vm-free VM + disk + NIC + public IP
- [ ] Delete Cosmos DB account
- [ ] Delete Azure AI Search resource
- [ ] Delete Document Intelligence resource
- [ ] Delete Container Registry (ACR)
- [ ] **KEEP**: Foundry `ResumeAgent` — tailor still uses it. `PersonalAssistant` agent is now unused (chat removed 2026-08-23) — can delete it.
- [ ] Vercel: remove dead env vars `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `FOUNDRY_AGENT_ENDPOINT` (only chat.mjs used them)
- [ ] Vercel: remove `VM_API` / `VM_API_URL` env vars
- [ ] Supabase: **disable legacy JWT API keys** (Settings → API Keys → Legacy tab)
- [x] Supabase: RLS enabled deny-all on documents/chunks/rate_limits (2026-08-20; service-role bypasses it, so app is unaffected)
- [ ] Update `CLAUDE.md`: delete the VM boot ritual section (no longer needed, ever)

## 5. Public launch track (after verify)

- [ ] Custom domain (~$10/yr, add to Vercel + Firebase authorized domains + `ALLOWED_ORIGINS` env)
- [ ] Sentry (free 5k errors/mo) for error monitoring
- [ ] Privacy policy page — resumes are PII, required before marketing
- [ ] Onboarding polish: first-run walkthrough or demo mode
- [ ] Retention features (PR 3 idea): watchlists + saved searches + Vercel cron email digest (Resend free tier)
- [ ] Smoke tests for the 8 API handlers (repo has zero tests)

## 6. Ideas parked (not blocking)

- **Explainable match "why" panel** — matchedSkills/missingSkills already in v2 responses; could add per-skill evidence quotes
- **GitHub enrichment for technical candidates** (idea from interviewstreet/hiring-agent) — pull repos, rank contributions on recruiter side
- **Model swapping** — gateway exposes 123 models at $0. Could A/B `aws/claude5_sonnet` vs `openai/gpt5_4_mini` for match scoring quality via `LLM_FAST_MODEL` / `LLM_SMART_MODEL` env vars, no code change.
- **WeCongest** — separate project mentioned 2026-07-16, scope undefined

## Cost after decommission

| Item | Monthly |
|:---|:---|
| Supabase (job-nexus-prod) | $10 (on Pro org plan) |
| Vercel | $0 (Hobby) |
| LLM calls (embeddings + match scoring) | **$0** — ASU AIML gateway |
| LlamaParse | $0 (1k pages/day free) |
| Azure Foundry agents | minimal (pay-per-call) |
| **Total** | **~$10 vs ~$130–200 before** |
