"use client";

/**
 * Resume download Turnstile verification + progress modal.
 *
 * Presentational wrapper around Turnstile, the AI progress indicator, and the
 * success/loading spinner. Extracted from `ResumeDownload.tsx` so the main
 * component stays focused on state and orchestration.
 *
 * @module components/data/resume-download/TurnstileModal
 */

import type { RefObject } from "react";
import { AlertCircle, X } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { AIProgressIndicator, type AIProgressStage } from "@/components/ui/AIProgressIndicator";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { DownloadStatus } from "./types";

interface TurnstileModalProps {
  siteKey: string;
  theme: "light" | "dark";
  status: DownloadStatus;
  errorMessage: string | null;
  verifiedToken: string | null;
  aiStage: AIProgressStage;
  aiProvider: AIProvider;
  aiRetryCount: number;
  isJobDescriptionMode: boolean;
  statusMessage: string;
  turnstileRef: RefObject<TurnstileInstance | null>;
  /**
   * Monotonically increasing counter forwarded to the inner `<Turnstile>` as
   * its React `key`. Bumping the value unmounts the current widget and mounts
   * a fresh one, which is the only reliable way to force Cloudflare to issue
   * a NEW challenge token. `reset()` on the widget ref can return the same
   * cached solved-challenge token, which the server's in-memory replay Set
   * rejects as "Token already used" on the next attempt.
   */
  turnstileKey: number;
  onClose: () => void;
  onSuccess: (token: string) => void;
  onError: () => void;
  onExpire: () => void;
  onRetry: () => void;
}

/**
 * Modal shell + body selector for the resume download flow.
 *
 * Renders the Turnstile challenge, the error panel, the AI progress stages,
 * or the heuristic-mode spinner depending on the current `status`, `aiStage`,
 * and `verifiedToken`.
 */
export function TurnstileModal(props: TurnstileModalProps) {
  const {
    siteKey,
    theme,
    status,
    errorMessage,
    verifiedToken,
    aiStage,
    aiProvider,
    aiRetryCount,
    isJobDescriptionMode,
    statusMessage,
    turnstileRef,
    turnstileKey,
    onClose,
    onSuccess,
    onError,
    onExpire,
    onRetry,
  } = props;

  const isCompiling = status === "loading_wasm" || status === "generating";
  const showProgressBody = verifiedToken || isCompiling;
  // When the pipeline has errored, show the error panel alone and do NOT
  // render the Turnstile widget. A fresh widget mount auto-executes the
  // challenge, which calls onSuccess → re-enters useDownloadExecution → loops
  // on persistent server failures (e.g. unavailable AI model) and burns
  // through the per-IP rate limit. The user clicks "Try again" to explicitly
  // re-mount the widget (handleRetry flips status back to "idle").
  const isErrored = status === "error";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <GlassPanel
        padding="lg"
        radius="2xl"
        className="max-w-md w-full mx-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={status === "verifying"}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {!verifiedToken && !isErrored && (
          <div className="text-center mb-6">
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Verify You&apos;re Human
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Complete verification to download your resume
            </p>
          </div>
        )}

        {errorMessage && status === "error" && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{errorMessage}</p>
              <button
                onClick={onRetry}
                className="text-sm text-red-600 hover:text-red-800 font-medium mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isErrored ? null : showProgressBody ? (
          isJobDescriptionMode && aiStage !== "idle" ? (
            <div className="py-4">
              <AIProgressIndicator
                stage={aiStage}
                provider={aiProvider}
                retryCount={aiRetryCount}
                maxRetries={3}
                error={aiStage === "error" ? errorMessage || undefined : undefined}
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  {isCompiling ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  ) : (
                    <svg
                      className="w-8 h-8 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  {isCompiling ? statusMessage : "Verification Complete!"}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  {isCompiling ? "Please wait..." : "Starting your download..."}
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center p-3 relative">
            <div className="absolute inset-0 rounded-lg bg-slate-100 dark:bg-[#262626]" />
            <div className="relative z-10">
              <Turnstile
                key={turnstileKey}
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={onSuccess}
                onError={onError}
                onExpire={onExpire}
                options={{
                  theme: theme,
                  size: "normal",
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          disabled={status === "verifying"}
          className="mt-4 w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </GlassPanel>
    </div>
  );
}
