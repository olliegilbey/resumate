"use client";

import { Calendar, Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ContactLinks } from "@/components/ui/ContactLinks";
import resumeData from "@/data/resume-data.json";
import { useTheme } from "@/contexts/ThemeContext";
import { AboutSection } from "./_sections/AboutSection";
import { ContactCardTurnstileModal } from "./_sections/ContactCardTurnstileModal";
import { RecruiterCTA } from "./_sections/RecruiterCTA";
import { useContactCardFlow } from "./_sections/useContactCardFlow";

export default function HomePage() {
  const { theme } = useTheme();
  const {
    showTurnstileModal,
    isVerifying,
    verifiedToken,
    errorMessage,
    turnstileRef,
    openModal,
    handleTurnstileSuccess,
    handleTurnstileError,
    handleTurnstileExpire,
    handleManualDownloadClick,
    handleCloseModal,
    handleRetry,
  } = useContactCardFlow();

  // Validate Turnstile site key
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    console.error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured");
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-16 pb-8 md:pt-24 md:pb-12">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 pb-2 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 bg-clip-text text-transparent">
              {resumeData?.personal?.name || "Name Not Available"}
            </h1>

            {/* Contact Links - Compact Horizontal Style */}
            {resumeData?.personal && (
              <ContactLinks
                linkedin={resumeData.personal.linkedin || ""}
                github={resumeData.personal.github || ""}
                location={resumeData.personal.location || ""}
                variant="compact"
              />
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={openModal}
                disabled={isVerifying}
                size="lg"
                variant="gradient"
                className="w-full sm:w-auto min-w-[200px]"
              >
                <Download className="mr-2 h-4 w-4" />
                Get Contact Card
              </Button>
              {resumeData?.personal?.calendar && (
                <a
                  href={resumeData.personal.calendar}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button size="lg" variant="outline" className="w-full min-w-[200px]">
                    <Calendar className="mr-2 h-4 w-4" />
                    Book in my Cal
                  </Button>
                </a>
              )}
            </div>

            {showTurnstileModal && (
              <ContactCardTurnstileModal
                isVerifying={isVerifying}
                verifiedToken={verifiedToken}
                errorMessage={errorMessage}
                siteKey={siteKey || ""}
                theme={theme}
                turnstileRef={turnstileRef}
                onClose={handleCloseModal}
                onSuccess={handleTurnstileSuccess}
                onError={handleTurnstileError}
                onExpire={handleTurnstileExpire}
                onManualDownload={handleManualDownloadClick}
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>
      </div>

      <AboutSection
        summary={resumeData?.summary}
        interests={resumeData?.interests}
        location={resumeData?.personal?.location}
      />

      <RecruiterCTA />
    </main>
  );
}
