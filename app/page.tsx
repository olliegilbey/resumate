"use client";

import { Calendar, Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import resumeData from "@/data/resume-data.json";
import { useTheme } from "@/contexts/ThemeContext";
import { AboutSection } from "./_sections/AboutSection";
import { ContactCardTurnstileModal } from "./_sections/ContactCardTurnstileModal";
import { RecruiterCTA } from "./_sections/RecruiterCTA";
import { useContactCardFlow } from "./_sections/useContactCardFlow";

interface ContactItem {
  label: string;
  value: string;
  /** When set, the value renders as an external link. */
  href?: string;
}

/**
 * Inline contact line — one horizontal row on desktop (with thin dot
 * separators), a stacked label/value list on mobile. Pulled from the design
 * system v2 landing mock.
 *
 * Items with an `href` render their value as an external anchor; plain
 * items render as static text.
 */
function ContactStrip({ items }: { items: ReadonlyArray<ContactItem> }) {
  const renderValue = (item: ContactItem) =>
    item.href ? (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="tabular-nums underline decoration-slate-300 dark:decoration-slate-600 underline-offset-[3px] hover:text-aqua hover:decoration-[var(--accent-aqua)] transition-colors"
      >
        {item.value}
      </a>
    ) : (
      <span className="tabular-nums">{item.value}</span>
    );

  return (
    <>
      {/* Desktop: single horizontal row, left-aligned. */}
      <div className="hidden md:flex flex-wrap items-center text-[13px] leading-[1.4] text-slate-900 dark:text-slate-100">
        {items.map((item, i) => (
          <span key={item.label} className="inline-flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className="inline-block w-[3px] h-[3px] rounded-full mx-[14px] opacity-60 bg-slate-500 dark:bg-slate-400"
              />
            )}
            <span>
              <span className="text-slate-500 dark:text-slate-400 mr-2">{item.label}</span>
              {renderValue(item)}
            </span>
          </span>
        ))}
      </div>
      {/* Mobile: 3-line label + value stack. */}
      <div className="flex md:hidden flex-col gap-2 text-sm leading-[1.4] text-slate-900 dark:text-slate-100">
        {items.map((item) => (
          <div key={item.label}>
            <span className="text-slate-500 dark:text-slate-400 mr-3">{item.label}</span>
            {renderValue(item)}
          </div>
        ))}
      </div>
    </>
  );
}

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

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    console.error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured");
  }

  const fullName = resumeData?.personal?.name ?? "Name Not Available";
  // Split into two stacked words for the editorial layout. Falls back to a
  // single line if there is no space (single-word names).
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ");

  const linkedinHandle = resumeData?.personal?.linkedin;
  const githubHandle = resumeData?.personal?.github;
  const contactItems: ContactItem[] = [
    {
      label: "location",
      value: resumeData?.personal?.location ?? "—",
    },
    {
      label: "linkedin",
      value: linkedinHandle ? `in/${linkedinHandle}` : "—",
      href: linkedinHandle ? `https://linkedin.com/in/${linkedinHandle}` : undefined,
    },
    {
      label: "github",
      value: githubHandle ? `@${githubHandle}` : "—",
      href: githubHandle ? `https://github.com/${githubHandle}` : undefined,
    },
  ];

  const calendarHref = resumeData?.personal?.calendar;

  return (
    <main className="min-h-screen">
      {/* Hero — asymmetric: name (left) + equal-width clear-glass CTAs (right). */}
      <section className="relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 md:px-14 pt-16 pb-10 md:pt-20 md:pb-16">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12 md:items-end">
            {/* Name — large, light-weight, tight tracking, two-line stack. */}
            <h1
              className={[
                "m-0 font-light text-slate-900 dark:text-slate-100",
                "leading-[0.92] tracking-[-0.045em]",
                "text-[72px] md:text-[clamp(72px,11vw,116px)]",
              ].join(" ")}
            >
              {lastName ? (
                <>
                  {firstName}
                  <br />
                  {lastName}
                </>
              ) : (
                firstName
              )}
            </h1>

            {/* CTAs — stacked, equal width, both clear glass (variant primary). */}
            <div className="mt-7 md:mt-0 md:pb-2 flex flex-col gap-2.5 md:w-[230px] w-full">
              <Button
                onClick={openModal}
                disabled={isVerifying}
                size="lg"
                variant="primary"
                className="w-full"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Get Contact Card</span>
              </Button>
              {calendarHref && (
                <a href={calendarHref} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button size="lg" variant="primary" className="w-full">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Book in my Cal</span>
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Contact strip — full width below, single horizontal row on desktop. */}
          <div className="mt-8 md:mt-7">
            <ContactStrip items={contactItems} />
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
      </section>

      {/* About + Hire panels — full content width, stacked. */}
      <div className="max-w-5xl mx-auto px-6 md:px-14 pb-16 flex flex-col gap-8">
        <AboutSection
          summary={resumeData?.summary}
          interests={resumeData?.interests}
          location={resumeData?.personal?.location}
        />
        <RecruiterCTA />
      </div>
    </main>
  );
}
