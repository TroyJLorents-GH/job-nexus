import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { format, isValid } from 'date-fns'
import { Search, Filter, Edit, Trash2, Eye } from 'lucide-react'
import { useJobApplications, useDeleteJobApplication } from '../hooks/useJobApplications'
import type { JobApplication, JobStage } from '../types/job'

const columnHelper = createColumnHelper<JobApplication>()

const stageColors = {
  applied: 'bg-blue-100 text-blue-800',
  phone_screen: 'bg-yellow-100 text-yellow-800',
  technical_interview: 'bg-purple-100 text-purple-800',
  onsite_interview: 'bg-indigo-100 text-indigo-800',
  offer: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
} as const

const stageLabels = {
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical_interview: 'Technical Interview',
  onsite_interview: 'Onsite Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
} as const

export function JobList() {
  const { data: jobs = [], isLoading, error } = useJobApplications()
  const deleteJob = useDeleteJobApplication()

  const [globalFilter, setGlobalFilter] = useState('')
  const [stageFilter, setStageFilter] = useState<JobStage | 'all'>('all')

  const columns = useMemo(
    () => [
      columnHelper.accessor('company', {
        header: 'Company',
        cell: (info) => (
          <div className="font-medium text-gray-900">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor('position', {
        header: 'Position',
        cell: (info) => <div className="text-gray-700 whitespace-normal">{info.getValue()}</div>,
      }),
      columnHelper.accessor('appliedDate', {
        header: 'Applied Date',
        cell: (info) => {
          const d = new Date(info.getValue())
          return (
            <div className="text-gray-600">
              {isValid(d) ? format(d, 'MMM dd, yyyy') : '-'}
            </div>
          )
        },
      }),
      columnHelper.accessor('stage', {
        header: 'Stage',
        cell: (info) => {
          const stage = info.getValue()
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                stageColors[stage as keyof typeof stageColors]
              }`}
            >
              {stageLabels[stage as keyof typeof stageLabels]}
            </span>
          )
        },
      }),
      columnHelper.accessor('location', {
        header: 'Location',
        cell: (info) => (
          <div className="text-gray-600">{info.getValue() || '-'}</div>
        ),
      }),
      columnHelper.accessor('salary', {
        header: 'Salary',
        cell: (info) => (
          <div className="text-gray-600">{info.getValue() || '-'}</div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <div className="flex space-x-2">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: info.row.original.id }}
              className="text-blue-600 hover:text-blue-900"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Link
              to="/jobs/$jobId/edit"
              params={{ jobId: info.row.original.id }}
              className="text-gray-600 hover:text-gray-900"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this job application?')) {
                  deleteJob.mutate(info.row.original.id)
                }
              }}
              className="text-red-600 hover:text-red-900"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      }),
    ],
    [deleteJob],
  )

  const filteredData = useMemo(() => {
    let filtered = jobs

    if (stageFilter !== 'all') {
      filtered = filtered.filter((job) => job.stage === stageFilter)
    }

    if (globalFilter) {
      const q = globalFilter.toLowerCase()
      filtered = filtered.filter(
        (job) =>
          job.company.toLowerCase().includes(q) ||
          job.position.toLowerCase().includes(q) ||
          job.location?.toLowerCase().includes(q),
      )
    }

    return filtered
  }, [jobs, globalFilter, stageFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  })

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <h2 className="mt-6 text-lg font-semibold text-gray-900">Loading your dashboard...</h2>
        <p className="mt-2 text-sm text-gray-600">Fetching your job applications</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">Couldn't load your jobs</h2>
        <p className="mt-2 text-sm text-gray-600">This could be a temporary issue. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const hasAnyJobs = jobs.length > 0
  const hasFilteredRows = filteredData.length > 0

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Job Applications</h1>
          <p className="mt-2 text-sm text-gray-700">Track your job applications, interviews, and progress</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/jobs/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Add Job Application
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search companies, positions, or locations..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as JobStage | 'all')}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Stages</option>
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {hasFilteredRows && (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300 table-fixed">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-gray-50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-4 truncate">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty states */}
      {!hasFilteredRows && (
        <div className="text-center py-16 border border-dashed rounded-lg mt-8">
          {hasAnyJobs ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900">No matches</h3>
              <p className="mt-2 text-sm text-gray-600">Try clearing your search or stage filter.</p>
              <button
                onClick={() => { setGlobalFilter(''); setStageFilter('all') }}
                className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900">No jobs yet</h3>
              <p className="mt-2 text-sm text-gray-600">Start by adding your first application.</p>
              <Link
                to="/jobs/new"
                className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Job
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
