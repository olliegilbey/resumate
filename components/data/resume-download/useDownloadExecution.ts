"use client";

/**
 * Resume download execution hook.
 *
 * Thin React wrapper around {@link runDownloadPipeline}: fires the pipeline
 * once a Turnstile-verified token is available, records failure telemetry, and
 * resets the widget on error. Extracted from `ResumeDownload.tsx` so the main
 * component can stay focused on form state and layout.
 *
 * @module components/data/resume-download/useDownloadExecution
 */

import { useEffect, useRef, type RefObject } from "react";

import type { ResumeData, RoleProfile } from "@/types/resume";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { usePostHogResume } from "@/lib/posthog-client";
import type { DownloadErrorCode } from "@/lib/analytics/errors/types";
import type { AIProgressStage } from "@/components/ui/AIProgressIndicator";
import { postLogEvent } from "./pipeline";
import { runDownloadPipeline, type ErrorStageRef } from "./runDownloadPipeline";
import { MIN_JOB_DESCRIPTION_LENGTH, type DownloadErrorStage, type DownloadStatus } from "./types";

type Analytics = ReturnType<typeof usePostHogResume>;

interface UseDownloadExecutionParams {
  verifiedToken: string | null;
  downloadInitiated: boolean;
  status: DownloadStatus;
  jobDescription: string;
  aiProvider: AIProvider;
  selectedRoleId: string;
  roleProfiles: readonly RoleProfile[];
  resumeData: ResumeData;
  email: string;
  linkedin: string;
  analytics: Analytics;
  flowStartRef: RefObject<number>;
  setDownloadInitiated: (value: boolean) => void;
  setStatus: (value: DownloadStatus) => void;
  setAiStage: (value: AIProgressStage) => void;
  setAiRetryCount: (value: number) => void;
  setErrorMessage: (value: string | null) => void;
  setVerifiedToken: (value: string | null) => void;
  setEmail: (value: string) => void;
  setLinkedin: (value: string) => void;
  setShowTurnstile: (value: boolean) => void;
}

/**
 * Map a pipeline error stage onto the analytics error code + category + retry
 * hint.
 */
function mapErrorToTaxonomy(stage: DownloadErrorStage): {
  code: DownloadErrorCode;
  category: "ai" | "wasm" | "pdf";
  retryable: boolean;
} {
  if (stage === "ai_selection" || stage === "bullet_selection") {
    return { code: "AI_001", category: "ai", retryable: true };
  }
  if (stage === "wasm_load") {
    return { code: "WM_001", category: "wasm", retryable: true };
  }
  return { code: "PDF_001", category: "pdf", retryable: false };
}

/**
 * useEffect-driven download pipeline.
 *
 * Runs exactly once per verified token (guarded by `downloadInitiated`). On
 * error it records telemetry, resets the Turnstile widget, and surfaces the
 * failure via the provided setters so the UI can show a retry.
 */
export function useDownloadExecution(params: UseDownloadExecutionParams) {
  const {
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
  } = params;

  const errorStageRef = useRef<ErrorStageRef>({ current: "ai_selection" });

  useEffect(() => {
    if (!verifiedToken || downloadInitiated || status === "error") return;

    console.warn("Auto-triggering PDF download...");

    const isAIMode = jobDescription.trim().length >= MIN_JOB_DESCRIPTION_LENGTH;
    const currentProvider = aiProvider;
    const currentJobDescription = jobDescription.trim();
    errorStageRef.current.current = isAIMode ? "ai_selection" : "bullet_selection";

    const timer = setTimeout(async () => {
      setDownloadInitiated(true);

      const closeModal = () => {
        setShowTurnstile(false);
        setVerifiedToken(null);
        setEmail("");
        setLinkedin("");
        setErrorMessage(null);
        setDownloadInitiated(false);
        setStatus("idle");
        setAiStage("idle");
        setAiRetryCount(0);
        flowStartRef.current = 0;
      };

      try {
        await runDownloadPipeline({
          isAIMode,
          verifiedToken,
          jobDescription: currentJobDescription,
          aiProvider: currentProvider,
          selectedRoleId,
          roleProfiles,
          resumeData,
          email,
          linkedin,
          analytics,
          flowStartMs: flowStartRef.current,
          errorStageRef: errorStageRef.current,
          setStatus,
          setAiStage,
          setAiRetryCount,
          closeModal,
        });
      } catch (error) {
        console.error("Download error:", error);
        const errorMsg = error instanceof Error ? error.message : "Download failed";
        const errorStage = errorStageRef.current.current;
        setErrorMessage(errorMsg);
        setStatus("error");
        if (isAIMode) setAiStage("error");
        setDownloadInitiated(false);

        const taxonomy = mapErrorToTaxonomy(errorStage);
        analytics.error({
          generation_method: isAIMode ? "ai" : "heuristic",
          download_type: isAIMode ? "resume_ai" : "resume_heuristic",
          role_profile_id: isAIMode ? undefined : selectedRoleId,
          ai_provider: isAIMode ? currentProvider : undefined,
          error_code: taxonomy.code,
          error_category: taxonomy.category,
          error_stage: errorStage,
          error_message: errorMsg,
          is_retryable: taxonomy.retryable,
          duration_ms: Date.now() - flowStartRef.current,
        });

        const sessionId = sessionStorage.getItem("resumate_session");
        if (sessionId) {
          postLogEvent({
            event: "resume_failed",
            sessionId,
            roleProfileId: isAIMode ? "ai-curated" : selectedRoleId,
            roleProfileName: isAIMode
              ? "AI-Curated"
              : roleProfiles.find((r) => r.id === selectedRoleId)?.name || "Unknown",
            email: email || undefined,
            linkedin: linkedin || undefined,
            errorMessage: errorMsg,
            errorStage,
            errorStack:
              process.env.NODE_ENV === "development" && error instanceof Error
                ? error.stack
                : undefined,
            ...(isAIMode && { generation_method: "ai", ai_provider: currentProvider }),
          });
        }

        // Do NOT auto-reset the Turnstile widget here. With invisible/auto
        // challenges, reset() typically re-fires onSuccess synchronously,
        // which would re-enter this effect with a fresh token and loop on a
        // persistent server-side failure (e.g. unavailable AI model),
        // burning through the per-IP rate limit. The user-facing "Try again"
        // button in TurnstileModal already calls handleRetry, which performs
        // an explicit reset + state clear.
        setVerifiedToken(null);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [
    verifiedToken,
    downloadInitiated,
    status,
    selectedRoleId,
    roleProfiles,
    resumeData,
    email,
    linkedin,
    analytics,
    jobDescription,
    aiProvider,
    flowStartRef,
    setAiRetryCount,
    setAiStage,
    setDownloadInitiated,
    setEmail,
    setErrorMessage,
    setLinkedin,
    setShowTurnstile,
    setStatus,
    setVerifiedToken,
  ]);
}
