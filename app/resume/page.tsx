import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ResumeDownload } from "@/components/data/ResumeDownload";
import Link from "next/link";
import { Download, Eye, Sparkles, Briefcase, Users, Calendar } from "lucide-react";
import resumeData from "@/data/resume-data.json";
import { getTotalBullets, getTotalPositions } from "@/lib/resume-metrics";

export default function ResumePage() {
  // Calculate quick stats
  const yearsExperience = new Date().getFullYear() - 2018; // Started 2018
  const totalCompanies = resumeData.experience.length;
  const totalBullets =
    getTotalBullets(resumeData.experience) + getTotalPositions(resumeData.experience);

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16">
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
        <GlassPanel padding="lg" className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Professional Summary
          </h2>
          <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
            {resumeData.summary}
          </p>
        </GlassPanel>

        {/* Quick Stats + Explore Experience */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <GlassPanel padding="md" align="center">
            <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {yearsExperience}+
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Years</div>
          </GlassPanel>
          <GlassPanel padding="md" align="center">
            <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalCompanies}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Companies</div>
          </GlassPanel>
          <GlassPanel padding="md" align="center">
            <Users className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalBullets}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Achievements</div>
          </GlassPanel>
          <Link href="/resume/view" className="block group">
            <GlassPanel
              padding="md"
              align="center"
              className="h-full transition-all hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20 dark:hover:shadow-purple-400/20 cursor-pointer hover:-translate-y-0.5 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20"
            >
              <Eye className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                View All
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Experience</div>
            </GlassPanel>
          </Link>
        </div>

        {/* Download Resume - Full Width */}
        <GlassPanel padding="lg" className="mb-12">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Download Resume
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Role-tailored PDF with intelligent bullet selection
              </p>
            </div>
          </div>
          <ResumeDownload resumeData={resumeData} />
        </GlassPanel>

        {/* What is Resumate Section */}
        <GlassPanel padding="lg">
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
              <strong className="text-slate-900 dark:text-slate-100">Resumate</strong> is an
              intelligent resume curation system that uses AI to tailor resumes to specific job
              descriptions, or heuristic scoring against predefined role profiles.
            </p>

            <p>
              Explore all of my professional experience in an interactive format, search by tags or
              skills, then download a tailored PDF compiled client-side with Rust/WASM.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mt-6">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Features:</h4>
              <ul className="text-sm space-y-1">
                <li>✅ AI-powered bullet selection via job description</li>
                <li>✅ Heuristic role-based scoring and selection</li>
                <li>✅ Dynamic PDF generation with Rust/WASM (client-side)</li>
                <li>✅ Interactive experience explorer with tag filtering</li>
              </ul>
            </div>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
