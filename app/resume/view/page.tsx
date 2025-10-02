import { DataExplorer } from "@/components/data/DataExplorer"
import { ResumeData } from "@/types/resume"
import resumeData from "@/data/resume-data.json"

export default function ResumeViewPage() {
  return (
    <main className="min-h-screen">
      <DataExplorer data={resumeData as ResumeData} />
    </main>
  )
}
