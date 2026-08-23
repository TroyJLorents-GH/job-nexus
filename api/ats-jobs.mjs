// Vercel Serverless Function — fetches jobs directly from ATS platforms
// (Greenhouse, Lever, Ashby). Public JSON APIs, no auth required.
//
// Request body:
//   {
//     companies: [{ platform: 'greenhouse'|'lever'|'ashby', slug: string, name?: string }],
//     search_term?: string,  // case-insensitive title filter
//     remote_only?: boolean
//   }
//
// Response: { jobs: JobResult[], total: number, errors: [{ platform, slug, error }] }

import { verifyToken } from "./_auth.mjs";
import { handleCors, sendAuthError } from "./_http.mjs";
import { checkRateLimit } from "./_ratelimit.mjs";

const FETCH_TIMEOUT_MS = 8000;
const MAX_COMPANIES = 15;

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(html) {
  if (!html) return "";
  // Greenhouse double-escapes its content, so decode twice.
  return decodeEntities(decodeEntities(html))
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Greenhouse has no pay field on the board API, but most pay-transparent
 * postings state the range inline. Requires two comma-grouped dollar amounts,
 * which avoids matching equity or revenue figures.
 */
const PAY_RANGE_RE = /\$\s?(\d{2,3}(?:,\d{3})+)\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:,\d{3})+)/;

function extractPayFromText(text) {
  const m = PAY_RANGE_RE.exec(text || "");
  if (!m) return undefined;
  return formatPay(Number(m[1].replace(/,/g, "")), Number(m[2].replace(/,/g, "")), "USD");
}

/** Render a pay range as a short display string, e.g. "$120k - $160k". */
function formatPay(min, max, currency) {
  const nums = [min, max].map((n) => (n == null ? null : Number(n))).filter((n) => n && n > 0);
  if (nums.length === 0) return undefined;
  const sym = currency === "USD" || !currency ? "$" : `${currency} `;
  const fmt = (n) => (n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${n}`);
  return nums.length === 2 && nums[0] !== nums[1] ? `${fmt(nums[0])} - ${fmt(nums[1])}` : fmt(nums[0]);
}

function titleCaseSlug(slug) {
  return slug
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "job-nexus/1.0" } });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGreenhouse(slug, displayName) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Greenhouse ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const company = displayName || titleCaseSlug(slug);
  return (data.jobs || []).map((j) => {
    const plain = stripHtml(j.content);
    return {
      title: j.title,
      company,
      location: j.location?.name || j.offices?.[0]?.name || "",
      salary: extractPayFromText(plain),
      job_url: j.absolute_url,
      job_id: String(j.id ?? ""),
      site: "greenhouse",
      date_posted: j.updated_at,
      description: plain.slice(0, 300),
      full_description: plain,
    };
  });
}

async function fetchLever(slug, displayName) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Lever ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const company = displayName || titleCaseSlug(slug);
  return (data || []).map((j) => {
    const plain = j.descriptionPlain || stripHtml(j.description);
    const loc = j.categories?.location || "";
    const posted = j.createdAt ? new Date(j.createdAt).toISOString() : undefined;
    const range = j.salaryRange;
    return {
      title: j.text,
      company,
      location: loc,
      salary: formatPay(range?.min, range?.max, range?.currency),  // {interval, currency, min, max}
      job_url: j.hostedUrl,
      job_id: j.id,
      site: "lever",
      date_posted: posted,
      description: plain.slice(0, 300),
      full_description: plain,
    };
  });
}

async function fetchAshby(slug, displayName) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Ashby ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const company = displayName || data.name || titleCaseSlug(slug);
  return (data.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const plain = j.descriptionPlain || stripHtml(j.descriptionHtml);
      const salaryComp = j.compensation?.compensationTiers?.find((t) =>
        /salary/i.test(t.componentSummaries?.[0]?.summary || t.title || "")
      ) || j.compensation?.compensationTiers?.[0];
      return {
        title: j.title,
        company,
        location: j.location || j.address?.postalAddressRegion || "",
        salary:
          salaryComp?.tierSummary ||
          formatPay(salaryComp?.minValue, salaryComp?.maxValue, salaryComp?.currencyCode),
        job_url: j.jobUrl,
        job_id: j.id,
        site: "ashby",
        date_posted: j.publishedDate,
        description: plain.slice(0, 300),
        full_description: plain,
      };
    });
}

const FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
};

export default async function handler(req, res) {
  if (handleCors(req, res, ["POST"])) return;

  const auth = await verifyToken(req);
  if (auth.error) return sendAuthError(res, auth.error);

  if (!(await checkRateLimit(res, auth.userId, "ats-jobs"))) return;

  try {
    const body = req.body || {};
    const companies = (Array.isArray(body.companies) ? body.companies : []).slice(0, MAX_COMPANIES);
    const searchTerm = (body.search_term || "").toString().trim().toLowerCase();
    const remoteOnly = !!body.remote_only;

    if (companies.length === 0) {
      return res.status(400).json({ error: "companies array is required" });
    }

    const tasks = companies.map(async (c) => {
      const platform = (c.platform || "").toLowerCase();
      const slug = (c.slug || "").trim();
      const name = (c.name || "").trim() || undefined;
      const fetcher = FETCHERS[platform];
      if (!fetcher) throw new Error(`Unknown platform: ${platform}`);
      if (!slug) throw new Error(`Missing slug for ${platform}`);
      return { platform, slug, jobs: await fetcher(slug, name) };
    });

    const settled = await Promise.allSettled(tasks);
    const jobs = [];
    const errors = [];

    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        jobs.push(...r.value.jobs);
      } else {
        errors.push({
          platform: companies[i].platform,
          slug: companies[i].slug,
          error: r.reason?.message || String(r.reason),
        });
      }
    });

    let filtered = jobs;
    if (searchTerm) {
      filtered = filtered.filter((j) => j.title?.toLowerCase().includes(searchTerm));
    }
    if (remoteOnly) {
      filtered = filtered.filter((j) => /remote/i.test(j.location || "") || /remote/i.test(j.title || ""));
    }

    filtered.sort((a, b) => {
      const da = a.date_posted ? new Date(a.date_posted).getTime() : 0;
      const db = b.date_posted ? new Date(b.date_posted).getTime() : 0;
      return db - da;
    });

    return res.status(200).json({ jobs: filtered, total: filtered.length, errors });
  } catch (err) {
    console.error("ats-jobs error:", err);
    return res.status(500).json({ error: "Failed to fetch ATS jobs" });
  }
}
