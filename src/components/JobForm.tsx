import { useState, useEffect } from 'react'
import { useMatch, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useJobApplication, useCreateJobApplication, useUpdateJobApplication } from '../hooks/useJobApplications'
import type { JobApplicationFormData, JobStage, JobStatus } from '../types/job'

const stageOptions = [
  { value: 'applied', label: 'Applied' },
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'technical_interview', label: 'Technical Interview' },
  { value: 'onsite_interview', label: 'Onsite Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
]

export function JobForm() {
  const editMatch = useMatch({ from: '/jobs/$jobId/edit', shouldThrow: false })
  const jobId = editMatch?.params?.jobId
  const navigate = useNavigate()
  const isEditing = !!jobId

  const { data: existingJob } = useJobApplication(jobId || '')
  const createJob = useCreateJobApplication()
  const updateJob = useUpdateJobApplication()

  const [formData, setFormData] = useState<JobApplicationFormData>({
    company: '',
    position: '',
    appliedDate: new Date().toISOString().split('T')[0],
    stage: 'applied',
    status: 'active',
    salary: '',
    location: '',
    jobUrl: '',
    notes: '',
  })

  useEffect(() => {
    if (existingJob && isEditing) {
      setFormData({
        company: existingJob.company,
        position: existingJob.position,
        appliedDate: existingJob.appliedDate,
        stage: existingJob.stage,
        status: existingJob.status,
        salary: existingJob.salary || '',
        location: existingJob.location || '',
        jobUrl: existingJob.jobUrl || '',
        notes: existingJob.notes || '',
      })
    }
  }, [existingJob, isEditing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditing && jobId) {
      updateJob.mutate(
        { id: jobId, data: formData },
        { onSuccess: () => navigate({ to: '/jobs/$jobId', params: { jobId } }) },
      )
    } else {
      createJob.mutate(formData, {
        onSuccess: (newJob) => navigate({ to: '/jobs/$jobId', params: { jobId: newJob.id } }),
      })
    }
  }

  const handleInputChange = (field: keyof JobApplicationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <Link to="/jobs" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Dashboard
      </Link>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditing ? 'Edit Job Application' : 'Add New Job Application'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company *</label>
                <input
                  type="text" id="company" required
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700">Position *</label>
                <input
                  type="text" id="position" required
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="appliedDate" className="block text-sm font-medium text-gray-700">Applied Date *</label>
                <input
                  type="date" id="appliedDate" required
                  value={formData.appliedDate}
                  onChange={(e) => handleInputChange('appliedDate', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="stage" className="block text-sm font-medium text-gray-700">Stage *</label>
                <select
                  id="stage" required
                  value={formData.stage}
                  onChange={(e) => handleInputChange('stage', e.target.value as JobStage)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status *</label>
                <select
                  id="status" required
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value as JobStatus)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text" id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., San Francisco, CA"
                />
              </div>
              <div>
                <label htmlFor="salary" className="block text-sm font-medium text-gray-700">Salary Range</label>
                <input
                  type="text" id="salary"
                  value={formData.salary}
                  onChange={(e) => handleInputChange('salary', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., $100,000 - $150,000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="jobUrl" className="block text-sm font-medium text-gray-700">Job URL</label>
              <input
                type="url" id="jobUrl"
                value={formData.jobUrl}
                onChange={(e) => handleInputChange('jobUrl', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                id="notes" rows={4}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any notes about this job application..."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                to="/jobs"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={createJob.isPending || updateJob.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {createJob.isPending || updateJob.isPending
                  ? (isEditing ? 'Updating...' : 'Creating...')
                  : (isEditing ? 'Update Job' : 'Create Job')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
