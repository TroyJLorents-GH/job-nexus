# Next Steps — Post-Migration Checklist

Status as of 2026-07-19: All migration + hardening code pushed to main. Supabase live
(`job-nexus-prod`, us-east-1). Env vars in Vercel (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `LLAMA_CLOUD_API_KEY`). This push triggers the deploy
that puts the new stack live. **Azure VM no longer receives traffic.**

---

## 1. Verify the deploy (do first, ~15 min)

- [ ] Vercel dashboard → job-nexus → confirm the deployment from this push succeeded
- [ ] Open https://job-nexus-delta.vercel.app, sign in
- [ ] **Upload a resume** (Resume Pipeline) → should parse via LlamaParse and list the doc
- [ ] **Match** against a real job description → expect new response: confidence %, skill match %, matched/missing skill chips, recommendation text
- [ ] **Tailor** one result → still works (Azure Foundry ResumeAgent, unchanged)
- [ ] **Chat** with PersonalAssistant → ask about your uploaded resume (context now from Supabase)
- [ ] **Discover** → search requires login now; ATS search works; extract-from-URL works
- [ ] Check Supabase dashboard → Table Editor → `documents` + `chunks` have rows after upload

## 2. Security probes (~10 min)

- [ ] `curl -X POST https://job-nexus-delta.vercel.app/api/search-jobs` (no token) → expect **401**
- [ ] Burst any endpoint past its hourly limit → expect **429**
- [ ] `POST /api/extract-job` with `{"url":"http://169.254.169.254/"}` (with token) → expect **400** rejected
- [ ] Request from a foreign origin → no CORS allow header

## 3. Known issues to resolve

- [ ] **JobSpy backend** — `api/search-jobs.mjs` proxies to `JOBSPY_API_URL`. If that pointed at the Azure VM, aggregator search (LinkedIn/Indeed/Google) is dead now. Check where it points. Options: host JobSpy on Fly.io/Render (~$5/mo), or drop aggregator search (ATS + URL-extract still work).
- [ ] **Scanned-PDF fallback untested** — GPT-4o-mini vision path in `api/v2/analyze.mjs` has not run against a real scanned PDF. Test with one.
- [ ] **Rate limit numbers are guesses** — chat 30/hr, match 20/hr, analyze 10/hr etc. (`api/_ratelimit.mjs`). Tune after real usage.

## 4. Cleanup (after 1 week stable — target ~2026-07-26)

- [ ] Azure Portal: **delete** docker-vm-free VM + disk + NIC + public IP
- [ ] Delete Cosmos DB account
- [ ] Delete Azure AI Search resource
- [ ] Delete Document Intelligence resource
- [ ] Delete Container Registry (ACR)
- [ ] **KEEP**: Foundry agents (PersonalAssistant, ResumeAgent) — chat + tailor still use them
- [ ] Vercel: remove `VM_API` / `VM_API_URL` env vars
- [ ] Supabase: **disable legacy JWT API keys** (Settings → API Keys → Legacy tab) — only after step 1 verified
- [ ] Update `CLAUDE.md`: delete the VM boot ritual section (no longer needed, ever)

## 5. Public launch track (after verify)

- [ ] Custom domain (~$10/yr, add to Vercel + Firebase authorized domains + `ALLOWED_ORIGINS` env)
- [ ] Sentry (free 5k errors/mo) for error monitoring
- [ ] Privacy policy page — resumes are PII, required before marketing
- [ ] Onboarding polish: first-run walkthrough or demo mode
- [ ] Persist chat history (currently memory-only, lost on reload)
- [ ] Retention features (PR 3 idea): watchlists + saved searches + Vercel cron email digest (Resend free tier)
- [ ] Smoke tests for the 8 API handlers (repo has zero tests)

## 6. Ideas parked (not blocking)

- **Explainable match "why" panel** — matchedSkills/missingSkills already in v2 responses; could add per-skill evidence quotes
- **GitHub enrichment for technical candidates** (idea from interviewstreet/hiring-agent) — pull repos, rank contributions on recruiter side
- **ASU GPT Gateway** — 400+ models for dev/testing (needs endpoint URL + auth format, only model catalog known). Testing only; keep own OpenAI key for prod.
- **WeCongest** — separate project mentioned 2026-07-16, scope undefined

## Cost after decommission

| Item | Monthly |
|:---|:---|
| Supabase (job-nexus-prod) | $10 (on Pro org plan) |
| Vercel | $0 (Hobby) |
| OpenAI (embeddings + gpt-4o-mini) | ~$1–5 at current scale |
| LlamaParse | $0 (1k pages/day free) |
| Azure Foundry agents | minimal (pay-per-call) |
| **Total** | **~$15 vs ~$130–200 before** |
