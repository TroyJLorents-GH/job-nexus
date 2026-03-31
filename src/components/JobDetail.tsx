import { useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, Edit, ExternalLink, Plus } from 'lucide-react'
import { useJobApplication, useAddInterviewPrep } from '../hooks/useJobApplications'

const stageColors: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  phone_screen: 'bg-yellow-100 text-yellow-800',
  technical_interview: 'bg-purple-100 text-purple-800',
  onsite_interview: 'bg-indigo-100 text-indigo-800',
  offer: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
}

const stageLabels: Record<string, string> = {
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical_interview: 'Technical Interview',
  onsite_interview: 'Onsite Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function JobDetail() {
  const { jobId } = useParams({ from: '/jobs/$jobId' })
  const { data: job, isLoading, error } = useJobApplication(jobId)
  const addInterviewPrep = useAddInterviewPrep()
  const [showAddPrep, setShowAddPrep] = useState(false)
  const [prepTitle, setPrepTitle] = useState('')
  const [prepContent, setPrepContent] = useState('')

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">Job application not found</div>
        <Link to="/jobs" className="mt-4 text-blue-600 hover:text-blue-800">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Link to="/jobs" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Dashboard
      </Link>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{job.position}</h1>
            <p className="text-xl text-gray-600 mt-1">{job.company}</p>
            <div className="flex items-center mt-2 space-x-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${stageColors[job.stage]}`}>
                {stageLabels[job.stage]}
              </span>
              <span className="text-sm text-gray-500">
                Applied {format(new Date(job.appliedDate), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
          <Link
            to="/jobs/$jobId/edit"
            params={{ jobId }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Location</h3>
            <p className="mt-1 text-sm text-gray-900">{job.location || 'Not specified'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Salary Range</h3>
            <p className="mt-1 text-sm text-gray-900">{job.salary || 'Not specified'}</p>
          </div>
          {job.jobUrl && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-500">Job URL</h3>
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-blue-600 hover:text-blue-800 inline-flex items-center"
              >
                View Job Posting
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </div>
          )}
        </div>

        {job.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}

        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Interview Prep Notes</h3>
            <button
              onClick={() => setShowAddPrep(!showAddPrep)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </button>
          </div>

          {showAddPrep && (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg">
              <input
                type="text"
                placeholder="Note title"
                value={prepTitle}
                onChange={(e) => setPrepTitle(e.target.value)}
                className="w-full mb-2 p-2 border border-gray-300 rounded"
              />
              <textarea
                placeholder="Note content"
                value={prepContent}
                onChange={(e) => setPrepContent(e.target.value)}
                rows={3}
                className="w-full mb-2 p-2 border border-gray-300 rounded"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    if (prepTitle.trim() && prepContent.trim()) {
                      addInterviewPrep.mutate(
                        { jobId, title: prepTitle.trim(), content: prepContent.trim() },
                        {
                          onSuccess: () => {
                            setPrepTitle('')
                            setPrepContent('')
                            setShowAddPrep(false)
                          },
                        },
                      )
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddPrep(false); setPrepTitle(''); setPrepContent('') }}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {job.interviewPrep && job.interviewPrep.length > 0 ? (
            <div className="space-y-3">
              {job.interviewPrep.map((prep) => (
                <div key={prep.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{prep.title}</h4>
                    <span className="text-xs text-gray-500">
                      {format(new Date(prep.createdAt), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{prep.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No interview prep notes yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
