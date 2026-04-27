import { useState } from 'react'
import { Search, MapPin, Building, DollarSign, ExternalLink, Plus, Clock, FileText, Link as LinkIcon, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useCreateJobApplication } from '../hooks/useJobApplications'
import { apiFetch } from '../services/api'

interface JobResult {
  title: string
  company: string
  location: string
  salary?: string
  job_url: string
  site: string
  date_posted?: string
  description?: string
  full_description?: string
}

interface SearchResponse {
  jobs: JobResult[]
  total: number
  error?: string
  errors?: { platform: string; slug: string; error: string }[]
}

type AtsPlatform = 'greenhouse' | 'lever' | 'ashby'
interface AtsCompany {
  platform: AtsPlatform
  slug: string
  name?: string
}

export function Discover() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [location, setLocation] = useState('')
  const [resultsCount, setResultsCount] = useState(20)
  const [daysOld, setDaysOld] = useState(7)
  const [country, setCountry] = useState('USA')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [selectedSites, setSelectedSites] = useState<string[]>(['linkedin', 'indeed'])
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<JobResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [addingJob, setAddingJob] = useState<string | null>(null)
  const [extractUrl, setExtractUrl] = useState('')
  const [extracting, setExtracting] = useState(false)

  // ATS company search state
  const [atsCompanies, setAtsCompanies] = useState<AtsCompany[]>([])
  const [atsPlatform, setAtsPlatform] = useState<AtsPlatform>('greenhouse')
  const [atsSlug, setAtsSlug] = useState('')
  const [atsName, setAtsName] = useState('')
  const [atsSearching, setAtsSearching] = useState(false)
  const [atsErrors, setAtsErrors] = useState<{ platform: string; slug: string; error: string }[]>([])

  const createJob = useCreateJobApplication()

  const siteOptions = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'indeed', label: 'Indeed' },
    { value: 'google', label: 'Google' },
  ]

  const usingLinkedin = selectedSites.includes('linkedin')
  const usingIndeed = selectedSites.includes('indeed')

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a job title.')
      return
    }

    if (usingLinkedin && !location.trim() && !remoteOnly) {
      setError('Please add a location (or check "Remote only") for LinkedIn searches.')
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      // Use Vercel function in production, env var for local dev
      const apiBase = import.meta.env.VITE_JOBSPY_API_URL || '/api'

      let hours_old = daysOld > 0 ? daysOld * 24 : undefined
      if (usingIndeed && remoteOnly) {
        hours_old = undefined
      }

      const payload: Record<string, unknown> = {
        search_term: searchTerm,
        results_wanted: resultsCount,
        site_name: selectedSites,
        ...(remoteOnly ? { is_remote: true } : {}),
        ...(hours_old ? { hours_old } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(usingIndeed ? { country_indeed: country } : {}),
      }

      if (selectedSites.includes('google')) {
        const since = daysOld === 0 ? '' : daysOld === 1 ? ' since yesterday' : ` since ${daysOld} days ago`
        const locPart = location.trim() ? ` near ${location.trim()}` : remoteOnly ? ' remote' : ''
        payload.google_search_term = `${searchTerm} jobs${locPart}${since}`.trim()
      }

      const response = await fetch(`${apiBase.replace(/\/$/, '')}/search-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`Search failed: ${response.statusText}`)

      const data: SearchResponse = await response.json()
      if (data.error) throw new Error(data.error)

      setResults(Array.isArray(data.jobs) ? data.jobs : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddJob = async (job: JobResult) => {
    if (!user) {
      setError('Sign in to add jobs to your list.')
      return
    }

    setAddingJob(job.job_url)
    try {
      await createJob.mutateAsync({
        company: job.company,
        position: job.title,
        appliedDate: new Date().toISOString().split('T')[0],
        stage: 'applied',
        status: 'active',
        location: job.location,
        salary: job.salary,
        jobUrl: job.job_url,
        notes: `Found on ${job.site}\n\n${job.full_description || job.description || ''}`,
      })
    } catch (err) {
      console.error('Failed to add job:', err)
    } finally {
      setAddingJob(null)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    try { return new Date(dateStr).toLocaleDateString() }
    catch { return dateStr }
  }

  const handleSiteToggle = (site: string) => {
    setSelectedSites((prev) => prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site])
  }

  const handleExtractJob = async () => {
    if (!extractUrl.trim()) return
    setExtracting(true)
    setError(null)
    try {
      const res = await apiFetch('/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extractUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      // Navigate to resume pipeline with extracted job description
      window.location.href = `/resume-pipeline?jd=${encodeURIComponent(data.jobDescription)}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract job description')
    } finally {
      setExtracting(false)
    }
  }

  const handleMatchResumes = (job: JobResult) => {
    const desc = job.full_description || job.description || `${job.title} at ${job.company} - ${job.location}`
    window.location.href = `/resume-pipeline?jd=${encodeURIComponent(desc)}`
  }

  const handleAddAtsCompany = () => {
    const slug = atsSlug.trim().toLowerCase()
    if (!slug) return
    if (atsCompanies.some((c) => c.platform === atsPlatform && c.slug === slug)) {
      setAtsSlug('')
      setAtsName('')
      return
    }
    setAtsCompanies((prev) => [
      ...prev,
      { platform: atsPlatform, slug, name: atsName.trim() || undefined },
    ])
    setAtsSlug('')
    setAtsName('')
  }

  const handleRemoveAtsCompany = (platform: AtsPlatform, slug: string) => {
    setAtsCompanies((prev) => prev.filter((c) => !(c.platform === platform && c.slug === slug)))
  }

  const handleAtsSearch = async () => {
    if (atsCompanies.length === 0) {
      setError('Add at least one company to search their ATS.')
      return
    }
    setAtsSearching(true)
    setError(null)
    setAtsErrors([])
    try {
      const apiBase = import.meta.env.VITE_JOBSPY_API_URL || '/api'
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/ats-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companies: atsCompanies,
          search_term: searchTerm.trim() || undefined,
          remote_only: remoteOnly || undefined,
        }),
      })
      const data: SearchResponse = await response.json()
      if (!response.ok) throw new Error(data.error || `Search failed: ${response.statusText}`)
      setResults(Array.isArray(data.jobs) ? data.jobs : [])
      if (data.errors && data.errors.length > 0) setAtsErrors(data.errors)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ATS search failed')
      setResults([])
    } finally {
      setAtsSearching(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Jobs</h1>
          <p className="text-gray-600">Search for jobs across LinkedIn, Indeed, and Google</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g., Software Engineer"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g., San Francisco, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search Jobs
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Results</label>
              <select
                value={resultsCount}
                onChange={(e) => setResultsCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>All</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Posted Within</label>
              <select
                value={daysOld}
                onChange={(e) => setDaysOld(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={0}>Any time</option>
                <option value={1}>Past 24 hours</option>
                <option value={3}>Past 3 days</option>
                <option value={7}>Past 7 days</option>
                <option value={14}>Past 14 days</option>
                <option value={30}>Past 30 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Sites</label>
              <div className="space-y-1">
                {siteOptions.map((site) => (
                  <label key={site.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedSites.includes(site.value)}
                      onChange={() => handleSiteToggle(site.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{site.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Extra filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remote</label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Remote only</span>
              </label>
              {usingIndeed && remoteOnly && (
                <p className="text-xs text-gray-500 mt-1">
                  On Indeed, Remote can't be combined with "Posted Within". We'll prioritize Remote.
                </p>
              )}
            </div>

            {usingIndeed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country (Indeed)</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="USA">USA</option>
                  <option value="Canada">Canada</option>
                  <option value="UK">UK</option>
                  <option value="Australia">Australia</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Company Pages (ATS) */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Company Pages (ATS)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Fetch jobs directly from company career pages on Greenhouse, Lever, or Ashby. Faster and cleaner than
            scraping. The job-title filter above also applies here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={atsPlatform}
                onChange={(e) => setAtsPlatform(e.target.value as AtsPlatform)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
                <option value="ashby">Ashby</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company slug</label>
              <input
                type="text"
                placeholder="e.g., stripe"
                value={atsSlug}
                onChange={(e) => setAtsSlug(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddAtsCompany() }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name (optional)</label>
              <input
                type="text"
                placeholder="e.g., Stripe"
                value={atsName}
                onChange={(e) => setAtsName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddAtsCompany() }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddAtsCompany}
                disabled={!atsSlug.trim()}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 disabled:opacity-50"
              >
                Add Company
              </button>
            </div>
          </div>

          {atsCompanies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {atsCompanies.map((c) => (
                <span
                  key={`${c.platform}:${c.slug}`}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-800"
                >
                  <span className="font-medium">{c.name || c.slug}</span>
                  <span className="text-xs text-blue-600">{c.platform}</span>
                  <button
                    onClick={() => handleRemoveAtsCompany(c.platform, c.slug)}
                    className="hover:text-blue-900"
                    aria-label={`Remove ${c.slug}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleAtsSearch}
            disabled={atsSearching || atsCompanies.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {atsSearching ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Searching ATS...</>
            ) : (
              <><Building className="h-4 w-4" /> Search Company Pages ({atsCompanies.length})</>
            )}
          </button>

          {atsErrors.length > 0 && (
            <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <div className="font-medium mb-1">Couldn't fetch {atsErrors.length} source(s):</div>
              <ul className="list-disc list-inside">
                {atsErrors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">{e.platform}:{e.slug}</span> — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Extract from URL */}
        {user && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Extract Job from URL</h2>
            <p className="text-sm text-gray-600 mb-3">Paste a job posting URL to extract the description and match it against your resumes.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  value={extractUrl}
                  onChange={(e) => setExtractUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleExtractJob() }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleExtractJob}
                disabled={extracting || !extractUrl.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
              >
                {extracting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Extracting...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Extract &amp; Match</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Results count */}
        {results.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Found {results.length} jobs</h2>
          </div>
        )}

        {/* Job cards */}
        <div className="grid gap-6">
          {results.map((job, index) => (
            <div key={`${job.job_url}-${index}`} className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      {job.company}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </div>
                    {job.salary && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {job.salary}
                      </div>
                    )}
                    {job.date_posted && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(job.date_posted)}
                      </div>
                    )}
                  </div>

                  {job.description && (
                    <p className="text-gray-700 text-sm mb-3 line-clamp-3">{job.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">{job.site}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Job
                  </a>
                  {user && (
                    <>
                      <button
                        onClick={() => handleMatchResumes(job)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-purple-300 text-purple-700 hover:bg-purple-50 rounded"
                      >
                        <FileText className="h-4 w-4" />
                        Match Resumes
                      </button>
                      <button
                        onClick={() => handleAddJob(job)}
                        disabled={addingJob === job.job_url}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
                      >
                        {addingJob === job.job_url ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Add to List
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {results.length === 0 && !isSearching && !error && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Search for jobs</h3>
            <p className="text-gray-600">Enter a job title and location to find opportunities</p>
          </div>
        )}
      </div>
    </div>
  )
}
