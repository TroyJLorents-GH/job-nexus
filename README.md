---
project: projects/job-nexus
type: readme
---

# Job Nexus

Your complete job-search command center. Job Nexus is a single-page web app for tracking job applications, discovering open roles across multiple sources, matching your resumes against job descriptions with AI, getting tailoring suggestions, and chatting with an AI career assistant — all in one place.

The frontend is a React 19 + Vite single-page app. The backend is a set of Vercel serverless functions (Node, `.mjs`) under `api/`. Persistence for tracked applications lives in Firebase Firestore (per-user subcollections). Resume documents and semantic matching are served by an external "VM API" backend (proxied through the serverless functions), with a documented migration plan to move that stack to Supabase pgvector (see `MIGRATION.md`).

---

## Features

- **Application tracking** — Create, edit, and delete job applications stored per-user in Firestore. Each application tracks company, position, applied date, stage (applied → phone screen → technical → onsite → offer / rejected / withdrawn), status (active/inactive/archived), salary, location, URL, notes, and interview-prep notes.
- **Job discovery** — Two discovery modes:
  - **Aggregator search** via a JobSpy backend (LinkedIn, Indeed, Google) with filters for location, recency, results count, country, and remote-only.
  - **Company ATS pages** — fetch jobs directly from Greenhouse, Lever, and Ashby public job-board APIs by company slug (no scraping, no auth).
- **Add jobs to your list** — One click to save a discovered job into your tracked applications.
- **Extract job from URL** — Paste a job-posting URL; a serverless function fetches the page, strips HTML, and uses GPT-4.1-mini to extract a clean job description, then hands it off to the resume pipeline.
- **Resume pipeline** — Upload resumes (PDF/DOCX/TXT), then match them against a pasted or extracted job description. Returns ranked matches with confidence score, skill-match percentage, matched/missing skills, an RRF hybrid-search score breakdown, and a side-by-side skill comparison view.
- **Resume tailoring** — For any matched resume, get the top 3–5 highest-impact tailoring suggestions from an Azure Foundry "ResumeAgent."
- **AI chat** — Streaming chat (SSE) backed by OpenAI models (GPT-5, GPT-4.1, GPT-4.1-mini, GPT-4o, GPT-4o-mini) plus an Azure Foundry "PersonalAssistant" agent. Supports a general mode and a code mode, OpenAI moderation pre-checks, conversation history, and local chat-session history (last 20).
- **Auth** — Firebase Authentication (Google sign-in). Protected routes require a signed-in user; serverless functions verify Firebase ID tokens.

---

## Architecture

```
Browser (React 19 SPA, Vite)
  │
  ├── Firebase Auth (Google sign-in)  ──► Firebase ID token
  ├── Firestore (client SDK)          ──► users/{uid}/applications  (tracked jobs)
  │
  └── fetch /api/*  (Authorization: Bearer <Firebase ID token>)
        │
        ▼
   Vercel Serverless Functions (api/*.mjs, Node)
        │  _auth.mjs verifies the Firebase ID token via firebase-admin
        │
        ├── chat.mjs          ──► OpenAI (streaming SSE) | Azure Foundry PersonalAssistant
        ├── extract-job.mjs   ──► fetch page HTML → OpenAI GPT-4.1-mini extraction
        ├── tailor-resume.mjs ──► Azure Foundry ResumeAgent
        ├── search-jobs.mjs   ──► JobSpy backend (FastAPI)  [proxy]
        ├── ats-jobs.mjs      ──► Greenhouse / Lever / Ashby public APIs
        ├── vm-analyze.mjs    ──► VM API /analyze    (resume upload/parse) [proxy]
        ├── vm-documents.mjs  ──► VM API /documents  (list/get/delete)     [proxy]
        └── vm-match-job.mjs  ──► VM API /match-job  (hybrid search match) [proxy]
```

### Routing & auth flow

- Client routing uses TanStack Router (`src/router.tsx`). Public routes: `/` (landing), `/login`, `/discover`. Protected routes (wrapped in a `withAuth` HOC): `/jobs`, `/jobs/new`, `/jobs/$jobId`, `/jobs/$jobId/edit`, `/resume-pipeline`, `/chat`.
- `AuthProvider` (`src/context/AuthProvider.tsx`) exposes `user`, `loading`, `signOut`. The `withAuth` HOC renders `<Login />` if there is no user.
- All authenticated API calls go through `apiFetch` (`src/services/api.ts`), which attaches the current Firebase ID token as a `Bearer` header. The serverless functions verify it in `api/_auth.mjs`.

### Data flows

- **Tracked applications** are stored client-side directly in Firestore at `users/{uid}/applications` via `src/services/jobs.firestore.ts`, wrapped in TanStack Query hooks (`src/hooks/useJobApplications.ts`).
- **Resume documents & matching** are not stored in Firestore — they're served by the external VM API and proxied through `api/vm-*.mjs`. The frontend hooks (`src/hooks/useDocuments.ts`) call `/api/vm-analyze`, `/api/vm-documents`, `/api/vm-match-job`.

---

## Setup & Installation

### Prerequisites

- Node.js (ES modules; Vite 7 / TypeScript 5.8). Use a current LTS.
- A Firebase project (Auth + Firestore enabled) and a Firebase service-account for the admin SDK.
- An OpenAI API key.
- (Optional / for full functionality) Azure Foundry agents, a JobSpy backend, and the VM API resume backend.

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in values (see [Configuration](#configuration--environment-variables)).

```bash
cp .env.example .env
```

`VITE_`-prefixed variables are exposed to the browser at build time (Firebase client config). The rest are server-side only and, in production, are set in the Vercel dashboard.

### Run

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run preview    # preview the production build
npm run lint       # eslint
```

> Note: the `/api/*` functions are Vercel serverless functions. Running them locally requires the Vercel CLI (`vercel dev`) or a deployment; `npm run dev` alone serves only the frontend.

### Deploy

Deploys to Vercel. `vercel.json` sets the framework to `vite` and rewrites `/api/*` to the functions and everything else to `index.html` (SPA fallback). Set all server-side environment variables in the Vercel project settings.

---

## Usage

1. **Sign in** with Google (`/login`).
2. **Discover** jobs (`/discover`) via aggregator search or company ATS pages, or **extract** a job from a posting URL.
3. **Add** interesting jobs to your tracked list (`/jobs`), where you can edit stage/status and add interview-prep notes.
4. **Resume pipeline** (`/resume-pipeline`): upload resumes, paste/auto-fill a job description, **Match Resumes** to see ranked fit, then **Tailor Resume** for AI suggestions.
5. **Chat** (`/chat`) with an AI assistant in general or code mode, switching between OpenAI models or the Personal Assistant agent.

---

## Configuration & Environment Variables

From `.env.example`:

**Client (browser, `VITE_` prefix — Firebase client config):**

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_JOBSPY_API_URL` | (optional, local dev only) JobSpy backend base URL; do not set in Vercel |

**Server (Vercel function env vars):**

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Firebase Admin service-account credentials (ID-token verification) |
| `OPENAI_API_KEY` | OpenAI (chat, job extraction, moderation) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `FOUNDRY_AGENT_ENDPOINT` | Azure Foundry PersonalAssistant agent |
| `RESUME_AGENT_TENANT_ID` / `RESUME_AGENT_CLIENT_ID` / `RESUME_AGENT_CLIENT_SECRET` / `RESUME_AGENT_ENDPOINT` | Azure Foundry ResumeAgent (tailoring) |
| `VM_API` / `VM_API_URL` | VM API backend base URL (resume upload, documents, matching) |
| `JOBSPY_API_URL` | JobSpy aggregator backend base URL |
| `LLAMA_CLOUD_API_KEY` | (planned, see `MIGRATION.md`) LlamaParse for the Supabase migration |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | (planned, see `MIGRATION.md`) Supabase pgvector backend |

> Security note: the committed `.env` in this repo contains live-looking secrets. Treat them as compromised — rotate any real keys and never commit secrets.

---

## Project Structure

```
job-nexus/
├── api/                      # Vercel serverless functions (Node, .mjs)
│   ├── _auth.mjs             # Firebase Admin init + ID-token verification
│   ├── chat.mjs              # OpenAI streaming chat + Foundry PersonalAssistant
│   ├── extract-job.mjs       # URL → HTML → GPT-4.1-mini job-description extraction
│   ├── tailor-resume.mjs     # Foundry ResumeAgent tailoring suggestions
│   ├── search-jobs.mjs       # Proxy → JobSpy aggregator backend
│   ├── ats-jobs.mjs          # Greenhouse / Lever / Ashby public job-board APIs
│   ├── vm-analyze.mjs        # Proxy → VM API /analyze (resume upload)
│   ├── vm-documents.mjs      # Proxy → VM API /documents (list/get/delete)
│   └── vm-match-job.mjs      # Proxy → VM API /match-job (hybrid match)
├── src/
│   ├── main.tsx              # App entry
│   ├── App.tsx
│   ├── router.tsx            # TanStack Router route tree + withAuth HOC
│   ├── components/           # Root, Landing, Login, JobList/Detail/Form,
│   │                         #   Discover, ResumePipeline, Chat
│   ├── context/AuthProvider.tsx
│   ├── hooks/                # useJobApplications, useDocuments (TanStack Query)
│   ├── services/
│   │   ├── api.ts            # apiFetch (attaches Firebase Bearer token)
│   │   └── jobs.firestore.ts # Firestore CRUD for applications
│   ├── lib/firebase.ts       # Firebase client init (auth, firestore)
│   └── types/job.ts          # JobApplication / stage / status types
├── public/favicon.svg
├── index.html
├── vercel.json               # Vite framework + SPA/API rewrites
├── vite.config.ts
├── tailwind.config.js / postcss.config.js
├── eslint.config.js
├── tsconfig*.json
├── MIGRATION.md              # Plan: move VM/Cosmos/AI-Search stack → Supabase pgvector
└── .env.example
```

---

## Notes

- **Two backends, intentionally:** Firestore holds tracked applications (client SDK), while resume parsing/matching is delegated to an external VM API behind the `vm-*` proxies. See `MIGRATION.md` for the documented plan to replace the Azure VM + Cosmos DB + Azure AI Search + Document Intelligence stack with Supabase pgvector + LlamaParse + OpenAI embeddings.
- **Streaming chat** uses Server-Sent Events; the chat function also runs an OpenAI moderation check before responding and supports an Azure Foundry agent (`PersonalAssistant`) that runs non-streamed.
- **Hybrid search scoring** in the resume match UI surfaces an RRF (Reciprocal Rank Fusion) score combining BM25 + vector similarity, normalized into a confidence percentage.
- **ATS discovery** hits Greenhouse, Lever, and Ashby public board APIs directly with per-source timeouts and soft-fails (partial results + per-source error list).
