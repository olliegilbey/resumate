"use client";

/**
 * Turnstile + close/retry handlers for the resume download widget.
 *
 * Pulls the five stateful callbacks used by `ResumeDownload` (and forwarded
 * to `TurnstileModal`) into a single hook so the main component stays under
 * the `max-lines` guardrail.
 *
 * @module components/data/resume-download/useDownloadHandlers
 */

import { useCallback, type RefObject } from "react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

import type { AIProvider } from "@/lib/ai/providers/types";
import type { usePostHogResume } from "@/lib/posthog-client";
import type { AIProgressStage } from "@/components/ui/AIProgressIndicator";
import { MIN_JOB_DESCRIPTION_LENGTH, type DownloadStatus } from "./types";

type Analytics = ReturnType<typeof usePostHogResume>;
type CancelStage = "turnstile" | "verified" | "compiling" | "ai_analyzing";

interface UseDownloadHandlersParams {
  analytics: Analytics;
  status: DownloadStatus;
  aiStage: AIProgressStage;
  verifiedToken: string | null;
  jobDescription: string;
  selectedRoleId: string;
  aiProvider: AIProvider;
  isJobDescriptionMode: boolean;
  flowStartRef: RefObject<number>;
  turnstileRef: RefObject<TurnstileInstance | null>;
  setVerifiedToken: (value: string | null) => void;
  setStatus: (value: DownloadStatus) => void;
  setAiStage: (value: AIProgressStage) => void;
  setAiRetryCount: (value: number) => void;
  setErrorMessage: (value: string | null) => void;
  setShowTurnstile: (value: boolean) => void;
  setEmail: (value: string) => void;
  setLinkedin: (value: string) => void;
  setDownloadInitiated: (value: boolean) => void;
}

/**
 * Internal: derive the cancellation stage reported to analytics given the
 * current UI state.
 */
function deriveCancelStage(
  isJobDescriptionMode: boolean,
  aiStage: AIProgressStage,
  verifiedToken: string | null,
  status: DownloadStatus,
): CancelStage {
  if (isJobDescriptionMode && aiStage !== "idle") {
    if (["analyzing", "selecting", "validating", "retrying"].includes(aiStage))
      return "ai_analyzing";
    if (aiStage === "compiling") return "compiling";
    if (aiStage === "verifying") return "turnstile";
    return "verified";
  }
  return verifiedToken
    ? status === "loading_wasm" || status === "generating"
      ? "compiling"
      : "verified"
    : "turnstile";
}

/**
 * Build the `{handleTurnstileSuccess, handleTurnstileError, handleTurnstileExpire,
 * handleCloseModal, handleRetry}` bundle wired up to analytics + state setters.
 */
export function useDownloadHandlers(params: UseDownloadHandlersParams) {
  const {
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
  } = params;

  const handleTurnstileSuccess = useCallback(
    (token: string) => {
      console.warn("Turnstile verified, token ready");
      setVerifiedToken(token);
      setStatus("idle");
      setErrorMessage(null);

      if (jobDescription.trim().length >= MIN_JOB_DESCRIPTION_LENGTH) {
        setAiStage("verifying");
      }

      analytics.verified({
        generation_method: isJobDescriptionMode ? "ai" : "heuristic",
        download_type: isJobDescriptionMode ? "resume_ai" : "resume_heuristic",
        role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
        ai_provider: isJobDescriptionMode ? aiProvider : undefined,
        turnstile_duration_ms: Date.now() - flowStartRef.current,
      });
    },
    [
      analytics,
      selectedRoleId,
      jobDescription,
      isJobDescriptionMode,
      aiProvider,
      flowStartRef,
      setVerifiedToken,
      setStatus,
      setErrorMessage,
      setAiStage,
    ],
  );

  const trackTurnstileFailure = useCallback(
    (code: "TN_001" | "TN_002", message: string) => {
      analytics.error({
        generation_method: isJobDescriptionMode ? "ai" : "heuristic",
        download_type: isJobDescriptionMode ? "resume_ai" : "resume_heuristic",
        role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
        ai_provider: isJobDescriptionMode ? aiProvider : undefined,
        error_code: code,
        error_category: "turnstile",
        error_stage: "turnstile",
        error_message: message,
        is_retryable: true,
        duration_ms: Date.now() - flowStartRef.current,
      });
    },
    [analytics, isJobDescriptionMode, selectedRoleId, aiProvider, flowStartRef],
  );

  const handleTurnstileError = useCallback(() => {
    setErrorMessage("Verification failed. Please try again.");
    setStatus("error");
    trackTurnstileFailure("TN_002", "Turnstile verification failed");
  }, [trackTurnstileFailure, setErrorMessage, setStatus]);

  const handleTurnstileExpire = useCallback(() => {
    setErrorMessage("Verification expired. Please refresh and try again.");
    setStatus("error");
    setVerifiedToken(null);
    trackTurnstileFailure("TN_001", "Turnstile verification expired");
  }, [trackTurnstileFailure, setErrorMessage, setStatus, setVerifiedToken]);

  const handleCloseModal = useCallback(() => {
    if (status === "verifying") return;

    if (flowStartRef.current > 0 && status !== "error") {
      analytics.cancelled({
        generation_method: isJobDescriptionMode ? "ai" : "heuristic",
        download_type: isJobDescriptionMode ? "resume_ai" : "resume_heuristic",
        role_profile_id: isJobDescriptionMode ? undefined : selectedRoleId,
        ai_provider: isJobDescriptionMode ? aiProvider : undefined,
        stage: deriveCancelStage(isJobDescriptionMode, aiStage, verifiedToken, status),
        duration_ms: Date.now() - flowStartRef.current,
      });
    }

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
    turnstileRef.current?.reset();
  }, [
    status,
    aiStage,
    verifiedToken,
    analytics,
    selectedRoleId,
    isJobDescriptionMode,
    aiProvider,
    flowStartRef,
    turnstileRef,
    setShowTurnstile,
    setVerifiedToken,
    setEmail,
    setLinkedin,
    setErrorMessage,
    setDownloadInitiated,
    setStatus,
    setAiStage,
    setAiRetryCount,
  ]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setStatus("idle");
    setVerifiedToken(null);
    turnstileRef.current?.reset();
  }, [setErrorMessage, setStatus, setVerifiedToken, turnstileRef]);

  return {
    handleTurnstileSuccess,
    handleTurnstileError,
    handleTurnstileExpire,
    handleCloseModal,
    handleRetry,
  };
}
