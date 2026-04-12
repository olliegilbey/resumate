import { DataExplorer } from "@/components/data/DataExplorer";
import resumeData from "@/data/resume-data.json";

export default function ResumeViewPage() {
  return (
    <main className="min-h-screen">
      <DataExplorer data={resumeData} />
    </main>
  );
}
