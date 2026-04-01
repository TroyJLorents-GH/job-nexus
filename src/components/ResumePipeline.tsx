import { useState, useRef, useEffect } from 'react'
import { Upload, Trash2, FileText, ChevronDown, ChevronUp, Wand2, ArrowLeftRight, CheckCircle, XCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useDocuments, useUploadDocument, useDeleteDocument } from '../hooks/useDocuments'
import { apiFetch } from '../services/api'

interface MatchResult {
  documentId: string
  filename?: string
  confidence: number
  skillMatchPercent?: number
  searchScore?: number
  matchedSkills?: string[]
  missingSkills?: string[]
  resumeKeyPhrases?: string[]
}

interface MatchResponse {
  matches: MatchResult[]
  recommendation?: string
  jobRequirements?: string[]
}

export function ResumePipeline() {
  const { data: documents = [], isLoading: docsLoading } = useDocuments()
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()

  const [jobDescription, setJobDescription] = useState('')

  // Pre-fill job description from URL search params (from Discover page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jd = params.get('jd')
    if (jd) setJobDescription(jd)
  }, [])
  const [matchResults, setMatchResults] = useState<MatchResponse | null>(null)
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({})
  const [tailoring, setTailoring] = useState<Record<string, boolean>>({})
  const [tailorResults, setTailorResults] = useState<Record<string, string>>({})
  const [tailorOpen, setTailorOpen] = useState<Record<string, boolean>>({})
  const [compareOpen, setCompareOpen] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      await uploadDoc.mutateAsync(file)
    } catch (err) {
      setError((err as Error).message)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleMatch = async () => {
    if (!jobDescription.trim()) return
    setMatching(true)
    setError('')
    setMatchResults(null)
    try {
      const resp = await apiFetch('/vm-match-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Matching failed')
      setMatchResults(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMatching(false)
    }
  }

  const handleTailor = async (result: MatchResult) => {
    const docId = result.documentId
    setTailoring((p) => ({ ...p, [docId]: true }))
    setError('')
    try {
      const docResp = await apiFetch(`/vm-documents?id=${docId}`)
      const docData = await docResp.json()
      if (!docResp.ok) throw new Error(docData.error || 'Failed to fetch resume')
      const resumeText = docData.fullText || docData.extractedText || ''
      if (!resumeText) throw new Error('No resume text found')

      const resp = await apiFetch('/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          matchedSkills: result.matchedSkills || [],
          missingSkills: result.missingSkills || [],
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Tailoring failed')

      setTailorResults((p) => ({ ...p, [docId]: data.suggestions }))
      setTailorOpen((p) => ({ ...p, [docId]: true }))
    } catch (err) {
      setError(`Tailor error: ${(err as Error).message}`)
    } finally {
      setTailoring((p) => ({ ...p, [docId]: false }))
    }
  }

  const toggle = (setMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, id: string) => {
    setMap((p) => ({ ...p, [id]: !p[id] }))
  }

  const confidenceColor = (c: number) => c >= 75 ? 'text-green-600' : c >= 50 ? 'text-yellow-600' : 'text-red-600'
  const confidenceBg = (c: number) => c >= 75 ? 'bg-green-100 text-green-800' : c >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  const barColor = (c: number) => c >= 75 ? 'bg-green-500' : c >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Resume Pipeline</h1>
        <p className="mt-1 text-sm text-gray-600">Upload resumes, match against job descriptions, and get tailoring suggestions</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Resume list */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4 lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Resumes</h2>

            <input type="file" accept=".pdf,.docx,.txt" hidden ref={fileInputRef} onChange={handleUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDoc.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 mb-3"
            >
              {uploadDoc.isPending ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing...</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload Resume</>
              )}
            </button>

            {docsLoading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No resumes uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{doc.filename || doc.name || doc.id}</span>
                    </div>
                    <button
                      onClick={() => deleteDoc.mutate(doc.id)}
                      className="text-gray-400 hover:text-red-600 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Job description + Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Job description input */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Job Description</h2>
            <textarea
              rows={4}
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 mb-3"
            />
            <button
              onClick={handleMatch}
              disabled={matching || !jobDescription.trim() || documents.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {matching ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Matching...</>
              ) : (
                'Match Resumes'
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {/* Loading bar */}
          {matching && <div className="h-1 bg-blue-100 rounded overflow-hidden"><div className="h-full bg-blue-500 animate-pulse w-full" /></div>}

          {/* Match Results */}
          {matchResults && (
            <div className="space-y-4">
              {matchResults.recommendation && (
                <div className={`rounded-md p-3 text-sm ${
                  (matchResults.matches?.[0]?.confidence ?? 0) >= 75 ? 'bg-green-50 text-green-800 border border-green-200' :
                  (matchResults.matches?.[0]?.confidence ?? 0) >= 50 ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                  'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}>
                  {matchResults.recommendation}
                </div>
              )}

              {matchResults.jobRequirements && matchResults.jobRequirements.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-500 mb-2">Job Requirements ({matchResults.jobRequirements.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {matchResults.jobRequirements.map((req, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs border border-gray-300 rounded-full text-gray-700">{req}</span>
                    ))}
                  </div>
                </div>
              )}

              {(matchResults.matches || []).map((result, idx) => (
                <div key={idx} className="bg-white rounded-lg shadow p-4 space-y-3">
                  {/* Header */}
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-semibold text-gray-900">{result.filename || `Resume ${idx + 1}`}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${confidenceBg(result.confidence)}`}>
                      {result.confidence}% Match
                    </span>
                  </div>

                  {/* Skill match bar */}
                  {result.skillMatchPercent != null && (
                    <div>
                      <p className="text-sm text-gray-500">Skill Match: {result.skillMatchPercent}%</p>
                      <div className="h-1.5 bg-gray-200 rounded-full mt-1">
                        <div className={`h-full rounded-full ${barColor(result.skillMatchPercent)}`} style={{ width: `${result.skillMatchPercent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Matched skills */}
                  {result.matchedSkills && result.matchedSkills.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Matched Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {result.matchedSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing skills */}
                  {result.missingSkills && result.missingSkills.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Missing Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {result.missingSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Score breakdown toggle */}
                  <button
                    onClick={() => toggle(setDetailsOpen, result.documentId)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    {detailsOpen[result.documentId] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Score Breakdown
                  </button>

                  {detailsOpen[result.documentId] && (
                    <div className="bg-gray-50 rounded-md p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">AI Search Score (RRF)</p>
                        <p className="text-lg font-bold text-gray-900">{result.searchScore ?? 'N/A'}</p>
                        <p className="text-xs text-gray-400">Hybrid BM25 + Vector</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Confidence</p>
                        <p className={`text-lg font-bold ${confidenceColor(result.confidence)}`}>{result.confidence}%</p>
                        <p className="text-xs text-gray-400">Normalized from RRF</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Skill Match</p>
                        <p className={`text-lg font-bold ${confidenceColor(result.skillMatchPercent ?? 0)}`}>{result.skillMatchPercent}%</p>
                        <p className="text-xs text-gray-400">{result.matchedSkills?.length || 0}/{(result.matchedSkills?.length || 0) + (result.missingSkills?.length || 0)} requirements</p>
                      </div>
                    </div>
                  )}

                  {/* Side-by-Side Comparison toggle */}
                  {(result.matchedSkills?.length || result.missingSkills?.length) ? (
                    <>
                      <button
                        onClick={() => toggle(setCompareOpen, result.documentId)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        Side-by-Side Comparison
                        {compareOpen[result.documentId] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {compareOpen[result.documentId] && (
                        <ComparisonView
                          matchedSkills={result.matchedSkills || []}
                          missingSkills={result.missingSkills || []}
                          resumeKeyPhrases={result.resumeKeyPhrases || []}
                          filename={result.filename}
                          skillMatchPercent={result.skillMatchPercent ?? 0}
                        />
                      )}
                    </>
                  ) : null}

                  {/* Tailor button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTailor(result)}
                      disabled={!!tailoring[result.documentId]}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 disabled:opacity-50"
                    >
                      {tailoring[result.documentId] ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" /> Tailoring...</>
                      ) : (
                        <><Wand2 className="h-4 w-4" /> Tailor Resume</>
                      )}
                    </button>
                    {tailorResults[result.documentId] && (
                      <button
                        onClick={() => toggle(setTailorOpen, result.documentId)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {tailorOpen[result.documentId] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {/* Tailor results */}
                  {tailorOpen[result.documentId] && tailorResults[result.documentId] && (
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3 prose prose-sm max-w-none">
                      <p className="text-sm font-semibold text-purple-700 mb-2">ResumeAgent Suggestions</p>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {tailorResults[result.documentId]}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Side-by-side comparison component */
function ComparisonView({
  matchedSkills,
  missingSkills,
  resumeKeyPhrases,
  filename,
  skillMatchPercent,
}: {
  matchedSkills: string[]
  missingSkills: string[]
  resumeKeyPhrases: string[]
  filename?: string
  skillMatchPercent: number
}) {
  const allJobSkills = [...matchedSkills, ...missingSkills]
  const extraResumeSkills = resumeKeyPhrases.filter(
    (phrase) => !allJobSkills.some((s) => s.toLowerCase() === phrase.toLowerCase())
  )

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
      {/* Header stats */}
      <div className="flex justify-center gap-8 flex-wrap">
        <div className="text-center">
          <p className="text-3xl font-bold text-green-600">{matchedSkills.length}</p>
          <p className="text-xs text-gray-500">Matched</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-red-500">{missingSkills.length}</p>
          <p className="text-xs text-gray-500">Missing</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-600">{skillMatchPercent}%</p>
          <p className="text-xs text-gray-500">Coverage</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Job Requirements */}
        <div>
          <p className="text-sm font-bold text-gray-900 mb-2">
            Job Requirements ({allJobSkills.length})
          </p>
          <div className="space-y-1.5">
            {matchedSkills.map((skill, i) => (
              <div key={`m-${i}`} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-700">{skill}</span>
              </div>
            ))}
            {missingSkills.map((skill, i) => (
              <div key={`x-${i}`} className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-600">{skill}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Your Resume Skills */}
        <div>
          <p className="text-sm font-bold text-gray-900 mb-2">
            Your Resume: {filename || 'Resume'}
          </p>
          <div className="space-y-1.5">
            {matchedSkills.map((skill, i) => (
              <div key={`rm-${i}`} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-700">{skill}</span>
              </div>
            ))}
            {missingSkills.map((skill, i) => (
              <div key={`rx-${i}`} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-400 shrink-0" />
                <span className="text-sm text-gray-400 italic">{skill}</span>
              </div>
            ))}
            {extraResumeSkills.length > 0 && (
              <>
                <p className="text-xs text-gray-500 mt-2 mb-1">Additional skills on resume</p>
                {extraResumeSkills.slice(0, 10).map((skill, i) => (
                  <div key={`e-${i}`} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0 ml-1" />
                    <span className="text-sm text-gray-500">{skill}</span>
                  </div>
                ))}
                {extraResumeSkills.length > 10 && (
                  <p className="text-xs text-gray-500">+{extraResumeSkills.length - 10} more</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Visual bar */}
      <div className="px-1">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-semibold text-green-600">{matchedSkills.length} matched</span>
          <span className="text-xs font-semibold text-red-500">{missingSkills.length} gaps</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              skillMatchPercent >= 75 ? 'bg-green-500' : skillMatchPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${skillMatchPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
