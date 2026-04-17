"use client";

/**
 * Top-level resume download widget.
 *
 * Hosts the form state (contact info, role profile, job description, AI
 * provider) and composes the selection panel, Turnstile modal, handlers hook,
 * and download-execution hook. The heavy lifting lives in the sibling modules
 * under `resume-download/`.
 *
 * @module components/data/ResumeDownload
 */

import { useState, useRef, useMemo } from "react";
import { Download, Loader2 } from "lucide-react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/ThemeContext";
import { getTotalBullets, getTotalPositions } from "@/lib/resume-metrics";
import { usePostHogResume } from "@/lib/posthog-client";
import type { AIProgressStage } from "@/components/ui/AIProgressIndicator";
import { FALLBACK_ORDER, type AIProvider } from "@/lib/ai/providers/types";

import { SelectionPanel } from "./resume-download/SelectionPanel";
import { TurnstileModal } from "./resume-download/TurnstileModal";
import { useDownloadExecution } from "./resume-download/useDownloadExecution";
import { useDownloadHandlers } from "./resume-download/useDownloadHandlers";
import { useModelAvailability } from "./resume-download/useModelAvailability";
import {
  MIN_JOB_DESCRIPTION_LENGTH,
  type DownloadStatus,
  type ResumeDownloadProps,
} from "./resume-download/types";

export function ResumeDownload({ resumeData }: ResumeDownloadProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [aiProvider, setAiProvider] = useState<AIProvider>(FALLBACK_ORDER[0]!);
  const [email, setEmail] = useState<string>("");
  const [linkedin, setLinkedin] = useState<string>("");
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [aiStage, setAiStage] = useState<AIProgressStage>("idle");
  const [aiRetryCount, setAiRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [downloadInitiated, setDownloadInitiated] = useState(false);
  // Monotonically bumped to force the Turnstile widget to remount with a
  // fresh Cloudflare challenge. Cloudflare (and the @marsidev wrapper) can
  // otherwise hand back the same cached solved-challenge token across
  // close/reopen or retry, which the server's replay Set rejects as "Token
  // already used" on the second attempt (e.g. Qwen fails → switch to Llama).
  const [turnstileKey, setTurnstileKey] = useState(0);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const flowStartRef = useRef<number>(0);
  const { theme } = useTheme();
  const analytics = usePostHogResume();
  const modelAvailability = useModelAvailability(aiProvider, setAiProvider);

  const roleProfiles = useMemo(() => resumeData.roleProfiles || [], [resumeData.roleProfiles]);
  const totalExperiences = useMemo(
    () => getTotalBullets(resumeData.experience) + getTotalPositions(resumeData.experience),
    [resumeData.experience],
  );
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const isJobDescriptionMode = jobDescription.trim().length > 0;
  const isDropdownMode = selectedRoleId.length > 0;

  const handleDownloadClick = () => {
    if (!selectedRoleId && !jobDescription.trim()) {
      setErrorMessage("Please select a role or enter a job description");
      return;
    }

    setAiStage("idle");
    setAiRetryCount(0);
    setErrorMessage(null);
    // Force a fresh Turnstile widget on every download click. Without this,
    // a close/reopen (e.g. after a "busy" AI failure, user switches model
    // and clicks Download again) can re-use the previous token and hit the
    // server's replay guard.
    setTurnstileKey((k) => k + 1);
    setShowTurnstile(true);
    setStatus("idle");
    flowStartRef.current = Date.now();

    if (isJobDescriptionMode) {
      if (jobDescription.trim().length < MIN_JOB_DESCRIPTION_LENGTH) {
        setErrorMessage(
          `Job description too short (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters)`,
        );
        setShowTurnstile(false);
        return;
      }
      analytics.initiated({
        generation_method: "ai",
        download_type: "resume_ai",
        ai_provider: aiProvider,
        job_description_length: jobDescription.trim().length,
      });
    } else {
      const roleProfile = roleProfiles.find((r) => r.id === selectedRoleId);
      analytics.initiated({
        generation_method: "heuristic",
        download_type: "resume_heuristic",
        role_profile_id: selectedRoleId,
        role_profile_name: roleProfile?.name || "Unknown",
      });
    }
  };

  const {
    handleTurnstileSuccess,
    handleTurnstileError,
    handleTurnstileExpire,
    handleCloseModal,
    handleRetry,
  } = useDownloadHandlers({
    analytics,
    status,
    aiStage,
    verifiedToken,
    jobDescription,
    selectedRoleId,
    aiProvider,
    isJobDescriptionMode,
    flowStartRef,
    turnstileRef,
    setVerifiedToken,
    setStatus,
    setAiStage,
    setAiRetryCount,
    setErrorMessage,
    setShowTurnstile,
    setEmail,
    setLinkedin,
    setDownloadInitiated,
    bumpTurnstileKey: () => setTurnstileKey((k) => k + 1),
  });

  useDownloadExecution({
    verifiedToken,
    downloadInitiated,
    status,
    jobDescription,
    aiProvider,
    selectedRoleId,
    roleProfiles,
    resumeData,
    email,
    linkedin,
    analytics,
    flowStartRef,
    setDownloadInitiated,
    setStatus,
    setAiStage,
    setAiRetryCount,
    setErrorMessage,
    setVerifiedToken,
    setEmail,
    setLinkedin,
    setShowTurnstile,
  });

  const statusMessage = (() => {
    switch (status) {
      case "verifying":
        return "Verifying...";
      case "loading_wasm":
        return "Loading Typst compiler...";
      case "generating":
        return "Compiling with Typst...";
      case "error":
        return errorMessage || "Error occurred";
      default:
        return "Download PDF";
    }
  })();

  const isLoading = ["verifying", "loading_wasm", "generating"].includes(status);

  return (
    <div className="space-y-5">
      <SelectionPanel
        roleProfiles={roleProfiles}
        totalExperiences={totalExperiences}
        email={email}
        setEmail={setEmail}
        linkedin={linkedin}
        setLinkedin={setLinkedin}
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        selectedRoleId={selectedRoleId}
        setSelectedRoleId={setSelectedRoleId}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        modelAvailability={modelAvailability}
        isLoading={isLoading}
        isJobDescriptionMode={isJobDescriptionMode}
        isDropdownMode={isDropdownMode}
        onErrorMessageClear={() => setErrorMessage(null)}
      />

      <Button
        size="lg"
        className="w-full"
        onClick={handleDownloadClick}
        disabled={(!selectedRoleId && !jobDescription.trim()) || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {statusMessage}
          </>
        ) : (
          <>
            Download PDF
            <Download className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {errorMessage && !showTurnstile && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 text-center">{errorMessage}</p>
        </div>
      )}

      {showTurnstile && siteKey && (
        <TurnstileModal
          siteKey={siteKey}
          theme={theme}
          status={status}
          errorMessage={errorMessage}
          verifiedToken={verifiedToken}
          aiStage={aiStage}
          aiProvider={aiProvider}
          aiRetryCount={aiRetryCount}
          isJobDescriptionMode={isJobDescriptionMode}
          statusMessage={statusMessage}
          turnstileRef={turnstileRef}
          turnstileKey={turnstileKey}
          onClose={handleCloseModal}
          onSuccess={handleTurnstileSuccess}
          onError={handleTurnstileError}
          onExpire={handleTurnstileExpire}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
