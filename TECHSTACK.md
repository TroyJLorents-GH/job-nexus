---
project: projects/job-nexus
type: techstack
---

# Tech Stack — Job Nexus

## Languages

- **TypeScript** (~5.8) — frontend SPA (`src/`), strict typing via `tsconfig.app.json` / `tsconfig.node.json`.
- **JavaScript (ESM, `.mjs`)** — Vercel serverless functions (`api/`).
- **HTML / CSS** — `index.html` entry, Tailwind-driven styles (`src/index.css`).

## Frontend Frameworks & Libraries

| Library | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | ^19.1.1 | UI runtime (React 19). |
| `@tanstack/react-router` | ^1.131 | Client-side routing + `withAuth` HOC route protection (`src/router.tsx`). |
| `@tanstack/react-query` | ^5.85 | Server-state/data fetching and caching (job + document hooks). |
| `@tanstack/react-query-devtools` | ^5.85 | React Query devtools in development. |
| `@tanstack/react-table` | ^8.21 | Tabular rendering for job lists. |
| `firebase` | ^11.0 | Client SDK — Firebase Auth (Google sign-in) and Firestore (tracked applications). |
| `react-markdown` | ^9.0 | Render markdown tailoring output. |
| `remark-gfm` | ^4.0 | GitHub-flavored markdown plugin for `react-markdown`. |
| `lucide-react` | ^0.541 | Icon set. |
| `date-fns` | ^4.1 | Date formatting/manipulation. |
| `clsx` | ^2.1 | Conditional className composition. |

## Backend (Serverless) Libraries

| Library | Version | Purpose |
|---|---|---|
| `firebase-admin` | ^13.7 | Verify Firebase ID tokens server-side (`api/_auth.mjs`). |
| `openai` | ^6.33 | OpenAI-compatible client pointed at the ASU AIML gateway — embeddings, match scoring, job extraction. |
| `@azure/identity` | ^4.13 | `ClientSecretCredential` to obtain Azure AD tokens for Foundry agents. |

## Build Tools & Config

| Tool | Version | Role |
|---|---|---|
| `vite` | ^7.1 | Dev server + production bundler (`vite.config.ts`). |
| `@vitejs/plugin-react` | ^5.0 | React fast refresh / JSX transform. |
| `typescript` | ~5.8 | Type checking; build is `tsc -b && vite build`. |
| `tailwindcss` | ^3.4 | Utility-first CSS (`tailwind.config.js`). |
| `@tailwindcss/forms` | ^0.5 | Form-element styling plugin. |
| `postcss` | ^8.5 | CSS pipeline (`postcss.config.js`). |
| `autoprefixer` | ^10.4 | Vendor prefixing. |
| `eslint` | ^9.33 | Linting (`eslint.config.js`, flat config). |
| `typescript-eslint` | ^8.39 | TypeScript ESLint rules. |
| `eslint-plugin-react-hooks` | ^5.2 | React hooks lint rules. |
| `eslint-plugin-react-refresh` | ^0.4 | Fast-refresh lint constraints. |
| `@eslint/js` / `globals` | ^9.33 / ^16.3 | Base ESLint config + global definitions. |

## Deployment

- **Vercel** — `vercel.json` sets framework to `vite`, rewrites `/api/*` to serverless functions and all other paths to `index.html` (SPA fallback).

## External APIs & Services (consumed)

- **ASU AIML gateway** (OpenAI-compatible) — embeddings (`openai/te3s`), match scoring + job-description extraction (`openai/gpt5_4_mini`). See `api/_llm.mjs`.
- **Azure AI Foundry** — one agent: `ResumeAgent` (resume tailoring), reached via OpenAI-protocol responses endpoint with Azure AD bearer token.
- **Firebase** — Authentication (Google) and Firestore.
- **VM API** (external resume backend) — `/analyze`, `/documents`, `/match-job`; proxied through `api/vm-*.mjs`.
- **JobSpy backend** (FastAPI) — aggregator job search across LinkedIn, Indeed, Google; proxied through `api/search-jobs.mjs`.
- **ATS public job-board APIs** — Greenhouse, Lever, Ashby (`api/ats-jobs.mjs`), called directly, no auth.
- **(Planned, see `MIGRATION.md`)** — Supabase (pgvector) + LlamaParse (LlamaCloud) + OpenAI embeddings to replace the Azure VM / Cosmos DB / AI Search stack.

## Claude Skills / MCP Servers

- None configured in-project. No `.claude/` skill definitions, MCP server config, or `CLAUDE.md` present in the repository.
