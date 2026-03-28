import { Briefcase, ListChecks, FileText, Search, MessageSquare } from 'lucide-react'

export function Landing() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center bg-gray-50">
      <div className="max-w-3xl p-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Your complete job search command center.
        </h1>
        <p className="mt-3 text-gray-600">
          Track applications, discover opportunities, match resumes, and get AI-powered career guidance — all in one place.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <Feature
            icon={Briefcase}
            title="Track applications"
            desc="Log jobs, update stages, and keep every detail organized."
          />
          <Feature
            icon={Search}
            title="Discover jobs"
            desc="Search LinkedIn, Indeed, and more with built-in job scraping."
          />
          <Feature
            icon={ListChecks}
            title="Match resumes"
            desc="AI-powered matching tells you which resume fits each role."
          />
          <Feature
            icon={FileText}
            title="Tailor resumes"
            desc="Get specific suggestions to optimize your resume for any job."
          />
          <Feature
            icon={MessageSquare}
            title="AI chat"
            desc="Ask questions, prep for interviews, and get career advice."
          />
        </div>

        <p className="mt-10 text-sm text-gray-500">
          Sign in to get started.
        </p>
      </div>
    </main>
  )
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600" />
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  )
}
