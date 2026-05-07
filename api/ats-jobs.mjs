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

const FETCH_TIMEOUT_MS = 8000;

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
      salary: undefined,
      job_url: j.absolute_url,
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
    return {
      title: j.text,
      company,
      location: loc,
      salary: undefined,
      job_url: j.hostedUrl,
      site: "lever",
      date_posted: posted,
      description: plain.slice(0, 300),
      full_description: plain,
    };
  });
}

async function fetchAshby(slug, displayName) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Ashby ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const company = displayName || data.name || titleCaseSlug(slug);
  return (data.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const plain = j.descriptionPlain || stripHtml(j.descriptionHtml);
      return {
        title: j.title,
        company,
        location: j.location || j.address?.postalAddressRegion || "",
        salary: undefined,
        job_url: j.jobUrl,
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const companies = Array.isArray(body.companies) ? body.companies : [];
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
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}
