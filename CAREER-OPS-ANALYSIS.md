# career-ops → job-nexus: Final Recommendation

## 1. Verdict

Port ideas, don't integrate. career-ops is a local CLI harness whose runtime is Claude Code and whose output is markdown files on disk; nothing in it can be dropped into a Vercel+Supabase app. What *is* worth taking is its product framing: one holistic 1–5 score with an explicit "below 4.0, don't apply" verdict, evidence-backed CV match, legitimacy flagged separately from fit, and interview story seeds — all of which job-nexus can deliver better (hosted, zero setup, $0 LLM, persisted, linked to a tracker). Everything else in career-ops (100+ portal scanners, Playwright, batch CLI workers, Go TUI, LinkedIn DM drafts, contract review, company research with web search) is either serverless-hostile, a second product, or zero-value at zero users. The honest pre-launch scope is one thing: replace the false-precision `confidence` blend in `api/v2/match-job.mjs` with a persisted, evidence-verified Fit Report that feeds the Firestore tracker — plus ~8h of foundation debt that three of four analyses independently hit.

## 2. Feature-gap matrix

| career-ops feature | job-nexus status | Verdict | Why |
|:--|:--|:--|:--|
| A role summary | MISSING (`extract-job.mjs` returns blob; `match-job.mjs` returns flat `requirements[]`) | **Port** | One fast JSON call, precondition for everything |
| B CV match | HAVE, stronger (RRF + multi-resume) but no evidence quotes, no must/nice weighting | **Port the upgrade** | Evidence + server-side substring verification vs `documents.full_text` is the biggest trust win |
| C level strategy | MISSING | **Port (field in eval JSON)** | Free inside the call; no separate `documents.meta` subproject |
| D comp research | MISSING; `ats-jobs.mjs` hardcodes `salary: undefined` | **Port parse-only** | ATS payloads already carry pay; JD-stated comp via LLM. No market-band estimation |
| E personalization | PARTIAL (`tailor-resume.mjs`, Azure Foundry) | **Port (3 hooks in eval)** | Feeds tailor/cover later |
| F interview stories | PARTIAL (manual `interviewPrep[]` in `JobDetail.tsx`) | **Port (5 seeds → `addInterviewPrep`)** | Reuses existing Firestore structure |
| F full prep plan / schedule | MISSING | Defer | Once-per-interview; seeds cover 80% |
| G legitimacy flags | MISSING | **Port** | One fast call, marketing hook, kept separate from score |
| G repost/ghost memory | MISSING | Defer | Store `jd_hash`+`source_url` now; signal needs weeks of data |
| H negotiation | MISSING | Defer | <5% reach offer stage in-app; afternoon prompt later |
| Holistic 1–5 score + verdict | PARTIAL (`confidence` 0.65/0.35 blend, no verdict) | **Port — this IS the product** | Replaces false precision |
| Archetype | MISSING | Defer (one string field OK) | Analytics behind it need volume |
| ATS PDF resume | MISSING (suggestions only) | Defer; fix tailor first | 25–35h editor/template/export; move off Azure now |
| HTML templates/fonts | MISSING | Skip | Teal-clone polish before an export exists |
| Cover letter | MISSING | Defer | 4h after eval lands; commoditized |
| Company deep-dive | MISSING | Defer/skip | Only item threatening $10/mo; slow; hallucination risk |
| Hiring manager discovery | MISSING | Skip | LinkedIn ToS hosted |
| LinkedIn DM / email templates | MISSING | Skip | Off the matching spine; ~zero value |
| Preconfigured companies | PARTIAL (ephemeral chips in `Discover.tsx`) | Port data file only | Import MIT list to `src/data/atsCompanies.ts` |
| Saved searches / watchlist | PARTIAL | Defer | Discover isn't the wedge |
| Scheduled scan + digest | MISSING | Defer | Resend domain, Hobby cron limits, ~30h; post-users |
| More ATS fetchers | PARTIAL (GH/Lever/Ashby) | Defer | Add on user demand |
| Wellfound / JobSpy / scrapers | PARTIAL (JobSpy probably dead) | Skip; kill JobSpy | Datacenter IPs get blocked; Landing still advertises it |
| Playwright liveness | MISSING | Skip as written; defer HTTP/JSON variant | No browser on Vercel |
| Batch evaluate N jobs | PARTIAL (inverse direction) | Defer | Needs single eval first; embedding-only tier first |
| Persisted evaluations | MISSING (`useState` only) | **Port — foundation** | Cache, `?jd=` URL hack fix, tracker spine |
| Link evals to tracker | MISSING (JD stuffed in `notes`, `stage:'applied'`) | **Port — do first** | 2h, unblocks everything |
| Status normalization | PARTIAL (enum lacks pre-apply) | Port `saved` only | No `applying`/`ghosted` sprawl |
| Rejection pattern detection | MISSING | Skip (schema keep) | n too small; LLM overfits noise |
| Funnel stats | MISSING | Defer | 4–6h client-only, post-launch |
| Mock interview | MISSING | Skip | Same page you just deleted |
| Debrief logs | PARTIAL | Defer | Add `kind` when touching type |
| Contract review | MISSING | Skip | Liability, rare, drags schema into search path |
| Salary-gap analyzer | MISSING | Defer | Afternoon prompt later |
| Terminal dashboard | N/A | N/A | Web UI is ahead |
| Never auto-submit | HAVE by omission | Keep as copy | Landing page principle |
| Local-only data | N/A | Port as trust parity | Delete-all + export + privacy policy = launch requirement |

## 3. TIER 1 — before/at launch

**1. Foundation debt (~6–8h total, do first)**
- `vercel.json`: add `functions` block with `maxDuration` (confirmed missing; Sonnet calls will hit 10s default). 0.5h.
- `src/types/job.ts` + `src/services/jobs.firestore.ts`: add optional `jobDescription`, `jobPostingId`, `resumeDocumentId`, `stageHistory[{stage,at}]`, `rejectedAtStage`, `evaluation` snapshot; write `stageHistory` in `updateJobApplication`; backfill JD on read by stripping `"Found on ..."` prefix from `notes`. Add `'saved'` to `JobStage`; update `stageLabels/stageColors` in `JobList.tsx`, `JobDetail.tsx`, `JobForm.tsx`; `Discover.tsx handleAddJob` → `stage:'saved'` + `jobDescription`. 2–3h.
- `api/ats-jobs.mjs`: parse Greenhouse `pay_input_ranges`, Ashby `compensation` (`includeCompensation=true`), Lever `salaryRange` instead of `salary: undefined`. 0.5–1h.
- `api/tailor-resume.mjs`: move to `llm()`/`MODELS.smart` from `api/_llm.mjs`; delete `@azure/identity` dep + `RESUME_AGENT_*` env. Last paid LLM dependency. 1–2h.
- `supabase/migrations/0002_*.sql`: backfill `bump_rate_limit`/`prune_rate_limits` SQL that prod depends on but the repo lacks. 20 min.

**2. Fit Report: persisted, evidence-verified eval with verdict (~30–40h honest)**
- What: `POST /api/v2/evaluate` — Stage 1 `JobAnalysis` (MODELS.fast, cached by `sha256(normalized JD)`): title/company/location/workMode, summary, priorities, must/nice requirements with `jdQuote`, level, stated comp, legitimacy flags. Stage 2 per-resume `ResumeEvaluation` (MODELS.smart, top 3 docs): per-requirement met/partial/missing with verbatim quotes, score 1–5 step 0.5, strengths/gaps, levelFit, 3 hooks, 5 interview seeds. Server-side: verdict derived (`>=4.0 apply / 3–3.5 stretch / <3 skip`), score caps when musts missing, evidence substring-verified against `documents.full_text`, tolerant JSON parse (gateway may not honor `response_format` on `aws/*`). Delete the third "recommendation synthesis" hop.
- Why: it is the product. Replaces `confidence` (a single-resume user always gets the full 35 retrieval points), answers "should I apply," and is the only thing Jobscan charges $50/mo for.
- Builds on: `api/v2/match-job.mjs` (`extractRequirements`, `hybrid_search` RRF, `analyzeResume`), `api/_llm.mjs`, `api/_embed.mjs`, `api/_supabase.mjs`, `api/_auth.mjs`, `api/_ratelimit.mjs` (add `evaluate: 20`, check cache before rate-limit), orphaned `api/v2/semantic-search.mjs` pattern, `src/components/ResumePipeline.tsx` (`MatchResult` contract stays a strict superset: `confidence = round(score*20)`).
- New: migration `0002` tables `job_postings(user_id, jd_hash unique, source_url, title, company, jd_text, embedding, analysis jsonb, analysis_prompt_version)` and `evaluations(user_id, job_posting_id, document_id, prompt_version, model, score, verdict, result jsonb, unique(user_id,job_posting_id,document_id,prompt_version))`, RLS deny-all. Endpoints `api/v2/evaluate.mjs`, `api/v2/evaluations.mjs` (GET by job), helpers `api/_eval.mjs`. Frontend `src/types/evaluation.ts`, `src/hooks/useEvaluate.ts`, `src/components/evaluate/{EvaluationReport,VerdictHeader,RoleSnapshot,FitBreakdown,StrengthsGaps,LevelAndComp,LegitimacyPanel,PersonalizationHooks,InterviewSeeds}.tsx`. Resume picker (demote multi-resume ranking to dropdown). Zero-resume path renders JD analysis only.

**3. Tracker linkage + `?job=` param (~6–8h, ships inside or right after #2)**
- What: `extract-job.mjs` writes to `job_postings` and returns `jobPostingId`; Discover navigates `/resume-pipeline?job=<id>` (keep `?jd=` fallback); "Save to tracker" creates a `saved` app with `jobPostingId`+`evaluation` summary; `JobDetail.tsx` gets a Fit card + "Evaluate fit" button; interview seeds → existing `useAddInterviewPrep`; `JobList.tsx` gets score badge column.
- Why: closes the seam every analysis found — resumes/matches in Supabase never linked to applications; JD lost in URL truncation.
- Builds on: `api/extract-job.mjs` (`validateUrl`, SSRF guard), `Discover.tsx handleAddJob`, `JobDetail.tsx`, `jobs.firestore.ts`.

**4. Launch hygiene (~4–6h, non-negotiable)**
- Delete-all-my-data endpoint (documents + chunks + Storage `resumes/{uid}/*` + Firestore `users/{uid}/applications`), JSON export, privacy policy page. Builds on `api/v2/documents.mjs` DELETE, `firebase-admin` in `api/_auth.mjs`.
- Confirm ASU gateway terms permit public (and later commercial) use. Launch-blocking question.
- Kill JobSpy (`api/search-jobs.mjs`, `JOBSPY_API_URL`) or host it; stop advertising LinkedIn/Indeed on `Landing.tsx` if killed.

## 4. TIER 2 — next month

1. **Cover letter** — `api/v2/cover-letter.mjs` (MODELS.smart) using `full_text` + `JobAnalysis` + hooks; markdown + copy button. Add `LIMITS["cover-letter"]`. 4–6h.
2. **Tailored resume rewrite (markdown first)** — `api/v2/rewrite-resume.mjs`: `full_text` + `tailorPriorities` + gaps → full rewritten markdown with honesty-check pass; copy/download `.md`. PDF templating later. 8–10h.
3. **HTTP/JSON liveness "Check now"** — `api/v2/check-liveness.mjs`: ATS-origin jobs re-fetch board JSON by `sourceJobId`; generic URLs via `extract-job` fetcher + 404/"no longer accepting" detection; client writes `livenessStatus` back. Needs `source`/`sourceJobId` on application (add in Tier 1 schema pass). 4–6h.
4. **Funnel stats** — client-only from `useJobApplications()` + `stageHistory`: per-stage counts, conversion %, median days. New `/insights` route or header strip on `/jobs`. 4–6h.
5. **Batch evaluate saved jobs (embedding-only tier)** — embed each JD once, cosine vs resume chunks, sortable "Fit" column in `JobList.tsx`; LLM deep-eval on click via existing `/v2/evaluate`. Needs `hybrid_search(p_document_ids)` param. 6–8h.

## 5. TIER 3 — later / maybe

- Scheduled scan + email digest / watch agents (needs domain + Resend + external cron; strongest post-users retention loop)
- Repost/ghost-job flag from `job_postings` history; crowd-sourced response-rate index (min-n, aggregate-only)
- Preconfigured company list (`src/data/atsCompanies.ts`) + per-user watchlist + more ATS fetchers on demand
- Full interview prep plan (`interviewDate`), debrief form with `InterviewPrep.kind`
- Negotiation framework + salary-gap analyzer gated on `stage==='offer'`
- PDF/DOCX resume export with templates (client print-CSS or `@react-pdf/renderer`; never serverless Chromium)
- Shareable read-only Fit Report link; resume-version outcome attribution; outcome-calibrated scoring
- Recruiter side (roles/candidates/bulk upload/public apply link) — 40–60h; revisit after seeker side has users
- Company research only if users ask and a search provider fits the budget

## 6. Ideas beyond career-ops (strategy lens, critic kept)

- **Crowd-sourced response-rate / ghost-job index** — every tracked app is a labeled datapoint; instrument now (`stageHistory`, `job_postings`), build the index at N users.
- **Outcome-calibrated scoring** — "4.5+ got screens 30% vs 5% below 4.0"; only a hosted app can earn it; it's the marketing stat.
- **Resume-version outcome attribution** — keep `resumeDocumentId` on the application now.
- **Shareable Fit Report link** — cheap once evaluations persist; referral/growth hook.
- **Recruiter "rank my applicants" + public apply link** — same `match-job` engine, both sides see the same score; revenue line, but deferred hard.
- **Pricing posture** — free unlimited scoring as the wedge ("Jobscan charges $50/mo for this"); charge only for exports/watch agents later; no weekly billing, refunds honored; never monetize auto-apply.

## 7. Do NOT build (and why)

- **Recruiter side now** — doubles surface, candidate PII obligations, 40–60h, seeker side hasn't launched.
- **Company research with Brave/Tavily** — the one item that threatens $10/mo; 15–40s; hallucination + cross-user staleness is a trust bug; users have Google.
- **Scan/digest/watch agents pre-launch** — domain, Resend, external cron, ~30h, zero users to retain.
- **Comp market-band estimation / BLS / H-1B ingest** — hallucinated bands labeled "estimate" are worse than nothing; levels.fyi is a tab away.
- **Rejection-pattern LLM insights** — n too small; will say something dumb over 12 apps.
- **Mock-interview chat** — the chat page you just deleted with a new system prompt.
- **Contract review** — liability, rare, drags `documents.kind` into the core search path.
- **LinkedIn DM / email templates / hiring-manager discovery** — off-spine, ToS risk, ~zero value; cheap is not a reason.
- **Playwright anything, Wellfound, JobSpy, residential-IP providers** — no browser on Vercel, datacenter IPs get blocked.
- **HTML templates/fonts, archetype taxonomy, prep-plan scheduler, negotiation/salary-gap, debrief red-flag detector, "questions asked at X" corpus, post-hire mode** — derivative of deferred features or retention theater at zero users.
- **More A–H sections than A/B/C/G + score + 3 hooks + 5 seeds** — every extra section is prompt bloat, latency, and a panel to maintain.

## 8. Recommended first PR

**Name:** `feat: foundations for fit report — tracker schema, saved stage, maxDuration, ATS pay, tailor on gateway`

**Files:**
- `vercel.json` — add `functions: { "api/**/*.mjs": { "maxDuration": 60 } }` (verify Fluid Compute status)
- `src/types/job.ts` — add `'saved'` to `JobStage`; optional `jobDescription`, `jobPostingId`, `resumeDocumentId`, `source`, `sourceJobId`, `stageHistory`, `rejectedAtStage`, `evaluation`
- `src/services/jobs.firestore.ts` — `updateJobApplication` appends `stageHistory` and sets `rejectedAtStage`; read-side backfill of `jobDescription` from `notes` `"Found on ..."` prefix
- `src/components/JobList.tsx`, `JobDetail.tsx`, `JobForm.tsx` — `saved` in `stageLabels/stageColors`/selects
- `src/components/Discover.tsx` — `handleAddJob` writes `stage:'saved'`, `jobDescription`, `source`, `sourceJobId`
- `api/ats-jobs.mjs` — populate `salary` from GH `pay_input_ranges`, Ashby `compensation`, Lever `salaryRange`
- `api/tailor-resume.mjs` — swap Azure Foundry for `llm()` MODELS.smart; `package.json` drop `@azure/identity`; `.env.example` drop `RESUME_AGENT_*`
- `supabase/migrations/0002_rate_limits_backfill.sql` — `bump_rate_limit`/`prune_rate_limits` as they exist in prod
- `NEXT-STEPS.md` — mark items, note gateway-terms question

**Acceptance criteria:**
- `npx tsc --noEmit` clean.
- Existing Firestore docs without new fields render unchanged in JobList/JobDetail.
- Discover "Add to List" creates an application with `stage:'saved'`, `jobDescription` populated, `appliedDate` empty; JobDetail shows the JD.
- Changing stage appends to `stageHistory`; setting `rejected` records `rejectedAtStage`.
- Real prod request to `/api/ats-jobs` for an Ashby/Greenhouse board with pay transparency returns non-undefined `salary` on at least one job.
- Real prod request to `/tailor-resume` succeeds with no Azure env vars set; `@azure/identity` absent from `package-lock.json`.
- `vercel.json` deploy shows 60s function limit in Vercel dashboard.
- Migration `0002` applies idempotently against prod (`create or replace function`).

---

# Appendix: Adversarial Critique

# Adversarial cut: career-ops ideas vs job-nexus

Frame I'm grading against: a tight "paste JD -> should I apply, with evidence -> act" product, solo-maintained, Vercel Hobby + Supabase, $0 LLM, launching soon. Anything that is a second product, a scraper, a data-acquisition project, or a feature the user touches once per job search is suspect.

Spot-checked before judging: `vercel.json` has no `functions`/`maxDuration` block (confirmed); `api/tailor-resume.mjs` still imports `@azure/identity` and calls Azure Foundry (confirmed); `LIMITS` has no evaluate/batch entries; `api/v2/semantic-search.mjs` exists and is orphaned.

## Verdict table (every idea, all four analyses, deduped)

| Idea (source rows) | Verdict | One-line reason |
|:--|:--|:--|
| A Role summary / JobAnalysis (FG1, F1, SU) | **keep** | One fast-model JSON call, zero new infra, makes the page answer "what is this job" and is the precondition for everything else. |
| B CV match with evidence quotes + must/nice weighting (FG2, SU §3) | **keep** | Already the core product; evidence quotes + server-side substring verification is the single best trust upgrade available and reuses `full_text`. |
| C Level strategy (FG3, F1, SU) | **keep (as one field in eval JSON)** | Free inside the eval call. Do NOT build `documents.meta` + upload-time level inference as a separate subproject; let the eval call infer it. |
| D Compensation: parse ATS pay fields + JD-stated comp (FG4a, F8 cheap tier, SU D-lite) | **keep** | ATS payloads already carry it and `ats-jobs.mjs` hardcodes `salary: undefined` — that's a 30-minute fix. |
| D Compensation research tier: BLS/H-1B ingest, comp_estimates table, "market band" (FG4b/c, F8 research tier) | **cut** | Hallucinated bands with an "estimate" label are worse than nothing; the H-1B CSV pipeline is a recurring data-ops chore for one chip. Levels.fyi is a tab away. |
| E Personalization hooks (FG5, SU) | **keep (3 bullets inside eval)** | Cheap, feeds tailor/cover. Not a separate endpoint. |
| F Interview story seeds -> "Add to prep notes" (FG6, F7, SU) | **keep** | Reuses `addInterviewPrep`; 5 questions with story hints from the same eval call. |
| F Full interview-prep plan endpoint + day-by-day schedule + `interviewDate` (FG29, F7 plan) | **defer** | Once-per-interview feature; the seeds cover 80%. Revisit after launch if people actually reach interview stage inside the app. |
| G Legitimacy flags from JD text + age (FG7a/b, F2 LLM tier, SU) | **keep** | One fast call, kept separate from score, becomes a marketing hook ("we flag ghost jobs"). Present as flags with reasons, never "scam". |
| G Repost/ghost memory via `jobs_seen`/`job_postings` cross-user (FG7c, FG28, F2 repost tier) | **defer** | Only produces signal after weeks of cross-user scans you don't have yet. Store `jd_hash` + `source_url` in `job_postings` now (free), build the flag later. |
| H Negotiation framework at offer stage (FG8, F8 offer-gap) | **cut (for launch)** | <5% of users reach it inside the app; it's a prompt you can add in an afternoon later. Not a launch item. |
| Holistic 1-5 score + apply/stretch/skip verdict (FG9, F1, S, SU) | **keep — this IS the product** | Replaces the false-precision `confidence` blend; threshold framing is career-ops's whole brand and you get it for free. |
| Archetype detection (FG10, S port #6, SU) | **defer** | One string field in JobAnalysis is harmless; the "you convert better on archetype X" analytics behind it needs volume you won't have. Don't design a taxonomy. |
| ATS-optimized tailored resume PDF/DOCX (FG11, F3, S port #5) | **defer (fix tailor first)** | Move `tailor-resume` off Azure Foundry to the gateway now (that's the real Azure leak and ~1h). The full editor + template + print-CSS + DOCX + `tailored_resumes` table is 14-20h of a second product. Ship "rewritten resume markdown + copy button" after launch; PDF templating after that. |
| HTML templates + custom fonts (FG12) | **cut** | Template picker before you have one working export is Teal-clone work. |
| Cover letter (FG23, F4) | **defer** | Low effort, but every competitor has it and it's commoditized; land the eval first, then this is a 4h add that reuses hooks. |
| Company deep-dive research w/ Brave/Tavily search (FG13, F5, S port #4) | **defer / cut at launch** | Needs an external search quota (the one thing that threatens $10/mo), 15-40s latency, hallucination risk. LLM-knowledge-only version is stale and embarrassing. Revisit only if users ask. |
| Hiring-manager discovery (FG14) | **cut** | LinkedIn ToS risk hosted; link-builders are a gimmick. |
| LinkedIn message drafting (FG15) | **cut** | Off the matching spine; LinkedIn does it natively. |
| Application email templates (FG16) | **cut** | Nobody sends formal application emails in 2026; off-product. |
| Preconfigured company list (`src/data/atsCompanies.ts`) (FG17, F9 catalog) | **keep (data file only)** | Import the MIT list, render chips. Slug rot is a known maintenance tax but it's a JSON file. |
| Per-user persisted watchlist / saved searches (FG18, F9 saved_searches) | **defer** | Nice, but it's a Discover feature; Discover is the weakest, most brittle surface and not the wedge. |
| Scheduled scan + email digest (F9 scan/digest, S "watch agents") | **defer** | Resend needs a verified domain you don't own, Hobby cron is daily/2 jobs, external scheduler, dedupe across users — 18-26h of ops for a retention loop that matters only after you have users to retain. Strongest post-launch item; wrong pre-launch. |
| More ATS fetchers (Workable, SmartRecruiters, Recruitee, Workday CXS…) (FG19/21) | **defer** | Same shape, cheap each — but each is a maintenance surface. Add on demand when a user names a company. |
| Wellfound / JobSpy aggregator / residential-IP providers (FG19, FG21) | **cut** | Scrapers from Vercel egress IPs get blocked; JobSpy is "probably dead" and the Landing page still advertises it. Decide: kill JobSpy and stop advertising LinkedIn/Indeed search, or pay $5 to host it — I'd kill it. |
| Playwright liveness (FG20 as written) | **cut** | No browser on Vercel; correctly marked N/A by all four. |
| HTTP/JSON liveness check of tracked jobs (FG20 adapted, F10, S port #2) | **defer** | User-driven "Check now" on ATS-origin jobs is ~4h and honest; cron variant needs admin Firestore iteration. Post-launch. |
| Batch evaluate N saved jobs vs one resume (FG22, F12) | **defer** | Needs the single-job eval first; then it's fan-out + chunking. Embedding-only instant tier is clever and free — do that version first when you get here. |
| Link evaluations to Firestore apps (`jobDescription`, `jobPostingId`, `evaluation` snapshot) (FG24, F foundation 1, SU §7) | **keep — do first** | The structural gap every analysis found: Discover stuffs JD into `notes` and sets `stage:'applied'`. 2h fix unblocks everything. |
| Extend `JobStage` with `saved` (FG25, SU open decision a) | **keep (just `saved`)** | Required for evaluate-then-decide. Skip `applying`/`ghosted` — stage sprawl. |
| `stageHistory` + `rejectedAtStage` written on update (FG26, F6) | **keep (schema only)** | Two fields in `updateJobApplication`; costs nothing, data accrues from day one. |
| Rejection-pattern LLM insights (FG26, F6 insights, S port #3) | **cut** | A single user never has the n for "patterns"; LLM over 12 applications overfits noise and will say something dumb. |
| Funnel stats page (FG27, F6 charts) | **defer** | Client-side, zero backend, but it's tracker polish; every tracker has it. After launch. |
| Persisted evaluation history / `evaluations` + `job_postings` tables (FG40, F1, SU §6) | **keep — foundation** | Cache makes re-view free, kills the `?jd=` URL hack, and is the spine for tracker linkage. |
| Mock-interview chat (FG30) | **cut** | You just deleted a chat page for being off-product; a "scoped" chat is the same page with a different system prompt. |
| Debrief log + `InterviewPrep.kind` (FG31, F7 debriefs) | **defer** | `kind` field is fine to add when you touch the type; the debrief form/UI is post-launch. |
| Process/company red-flag detector over debriefs (FG32) | **cut** | Derivative of a deferred feature; no data. |
| Contract/offer review companion + `documents.kind` + `hybrid_search` kind filter (FG33) | **cut** | Legal-adjacent liability, rare, and drags schema changes into the core search path for a feature almost no one reaches. |
| Salary-gap analyzer (FG34, F8 offer-gap) | **cut (for launch)** | Same as H: afternoon prompt later, not launch scope. |
| Terminal dashboard / experimental web UI (FG35/36) | **N/A** | Agreed. |
| Candidate-side filter / never auto-submit (FG37/38) | **keep (as principle/copy)** | Free; put it on the landing page. |
| Delete-all-my-data + JSON export + privacy policy (FG39) | **keep — pre-launch** | Not a feature, a launch requirement. You're storing resume PII publicly. |
| Move prompts to versioned server constants (FG §1) | **keep (trivially)** | `promptVersion` in the cache key — already in the SU schema. |
| `vercel.json` `maxDuration` (F foundation 3) | **keep — do first** | Confirmed missing. Sonnet eval calls will hit the 10s default and you'll debug ghosts. |
| Backfill `bump_rate_limit`/`prune_rate_limits` SQL into migrations (F foundation 2) | **keep** | Schema drift on a table prod depends on; 20 minutes. |
| Resume picker / `documents.is_primary` (F foundation 5, SU) | **keep** | Needed the moment the page stops being "rank my 5 resumes". |
| Recruiter side: roles/candidates/bulk upload/CSV/public apply link (F11, S d2, S monetization) | **defer hard** | It's the revenue thesis and the same engine — but 24-36h (realistically 40+), doubles the surface, adds candidate-PII obligations, and Troy explicitly wants tight. Ship seeker eval, get users, then decide. |
| Crowd-sourced response-rate / ghost-job index (S d1) | **defer** | Needs N users and min-n thresholds; the instrumentation (`stageHistory`, `job_postings`) is the keep; the index is a year-two moat. |
| Resume-version outcome attribution (S d4) | **defer** | Needs `resumeDocumentId` on the application (keep the field) and volume (don't have). |
| Outcome-calibrated scoring (S d5) | **defer** | Same; it's the marketing stat you can only earn after shipping. |
| Shareable Fit Report link (S d6) | **defer** | Cheap once evaluations persist; decent growth hook; not launch. |
| "Questions asked at X" anonymized corpus (S d7) | **cut** | Glassdoor-clone + SEO surface = third product. |
| Post-hire low-frequency mode (S d8) | **cut** | Retention theater for a product with zero users. |
| Paid tiers / pricing (S e) | **defer, with one blocker** | Confirm ASU gateway terms permit public/commercial use BEFORE marketing, let alone charging. That's a launch-blocking question, not a pricing one. |

## Effort estimates I think are wrong

| Claim | Why it's off |
|:--|:--|
| F1 A-H report 16-20h | Low. SU's version (two-stage, evidence verification, cache, tracker linkage, 8 components, `?job=` param, legacy-contract shim) is the honest scope and is 30-40h for one person. The four analyses together describe one feature three different ways; sum them, don't pick the smallest. |
| F3 tailored resume 14-20h | Low for PDF+DOCX+editor+diff+template+storage; realistic 25-35h. But the first 1-2h (move off Azure) is the only part that matters now. |
| F11 recruiter 24-36h | Low; bulk upload with LlamaParse quota, PII flows, role scoping in `hybrid_search`, a second rate-limit tier, and a new route tree is 40-60h. |
| F9 scan+digest 18-26h | Plausible for code, but omits domain purchase + Resend verification + deliverability debugging; call it 30h plus a recurring ops tax. |
| FG "Trivial" for LinkedIn/email drafting (rows 15/16) | Effort is right; value is ~zero. Cheap is not a reason to build. |
| FG4a ATS salary parsing "free" | Correct, and it's the best hour in the whole list. |
| F6 funnel 8-12h | High for client-only charts; 4-6h. Insights half is the part I'd cut anyway. |
| SU "6-12s first run" | Optimistic with `aws/claude5_sonnet` on 24k-char resumes x3 in parallel; plan for 15-25s and a progress UI. Measure `timingsMs` before committing to Sonnet by default. |

## Top 3 impact/effort

1. **The verdict+evidence eval with persistence** (FG9 + FG2 evidence + FG40, the SU proposal): it is the product; everything else is garnish. Build the two-stage version, cached in `job_postings`/`evaluations`, linked to the tracker. This is the whole pre-launch roadmap.
2. **Foundations under 1h each that are pure debt**: `vercel.json maxDuration`, `jobDescription`/`jobPostingId`/`resumeDocumentId`/`stageHistory` on `JobApplication`, `saved` stage, ATS pay-range parsing, tailor off Azure Foundry, backfill rate-limit SQL. Roughly 6-8h total, unblocks everything, removes the last paid dependency.
3. **Legitimacy flags + JD-stated comp + level** as fields in the same JobAnalysis call — zero marginal cost, differentiated vs Jobscan/Teal, and it's the headline you market ("we tell you when to skip, and when it's a ghost job").

## Top 3 most overrated

1. **Recruiter side / two-sided positioning** (S, F11): the strategy memo's revenue line rests on a product that doesn't exist, needs candidate PII handling, and doubles the surface of a solo app that hasn't launched its first side. Keep the `match-job` multi-doc primitive; don't build the UI yet.
2. **Company research with a web-search provider** (FG13, F5, S port #4): the only line item that actually threatens the $10 ceiling, slowest endpoint in the list, highest hallucination risk, and cached-cross-user staleness is a trust bug. Users already have Google.
3. **Scan/digest/watch-agents + crowd ghost-job index** (F9, S b2/d1/d3): real moats *eventually*, but they're retention/data-network features with hard ops dependencies (domain, Resend, external cron, N users). Three of the four analyses spent pages on them; at zero users they are premature by definition. Instrument now (store postings, stage history), build later.

Honorable mention for overrated: the analyses keep rediscovering "one holistic `MODELS.smart` call producing A/C/D/E/G/H/score/archetype" as if sections were free once the call exists — every extra section is prompt bloat, latency, and a UI panel to maintain. Ship A/B/C/G + score + 3 hooks + 5 seeds. Nothing else in the report.