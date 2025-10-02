import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { Download, Eye, Sparkles, Briefcase, Users, Calendar } from "lucide-react"
import resumeData from "@/data/resume-data.json"

export default function ResumePage() {
  // Calculate quick stats
  const yearsExperience = new Date().getFullYear() - 2018 // Started 2018
  const totalCompanies = resumeData.companies.length
  const totalBullets = resumeData.companies.reduce(
    (sum, company) => sum + company.positions.reduce(
      (posSum, pos) => posSum + 1 + pos.bullets.length, 0
    ), 0
  )

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            {resumeData.personal.fullName}
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            {resumeData.personal.location}
          </p>
        </div>

        {/* Professional Summary */}
        <div className="glass rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Professional Summary</h2>
          <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
            {resumeData.summary}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="glass rounded-xl p-6 text-center">
            <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{yearsExperience}+</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Years</div>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCompanies}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Companies</div>
          </div>
          <div className="glass rounded-xl p-6 text-center">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalBullets}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Achievements</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Download Resume Card */}
          <div className="glass rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Download className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Download Resume
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Traditional PDF format, optimized for ATS systems and recruiters.
            </p>
            <Button size="lg" className="w-full" disabled>
              Download PDF
              <Download className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              Static PDF coming soon
            </p>
          </div>

          {/* Explore Experience Card */}
          <div className="glass rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Eye className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Explore Full Experience
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Interactive data explorer with filtering, search, and detailed context.
            </p>
            <Link href="/resume/view">
              <Button size="lg" variant="secondary" className="w-full">
                View Experience
                <Eye className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* What is Resumate Section */}
        <div className="glass rounded-xl p-8">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 dark:from-blue-600 dark:to-purple-600 rounded-lg flex items-center justify-center mr-4">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              What is Resumate?
            </h2>
          </div>

          <div className="space-y-4 text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-900 dark:text-slate-100">Resumate</strong> is an intelligent resume curation system that will eventually
              use AI to tailor resumes based on specific role types and job descriptions.
            </p>

            <p>
              This current version showcases all of my professional experience in an interactive format,
              allowing you to explore achievements by tags, search for specific skills or accomplishments,
              and understand the full context behind each bullet point.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Coming Soon:</h4>
              <ul className="text-sm space-y-1">
                <li>• AI-powered resume customization by role type</li>
                <li>• Automatic bullet selection based on job descriptions</li>
                <li>• Dynamic PDF generation with Rust/WASM</li>
                <li>• Open-source framework for developers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
