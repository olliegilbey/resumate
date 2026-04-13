"use client";

/**
 * Contact-card Turnstile verification modal (landing page).
 *
 * Owns the visual modal only — all state and funnel-tracking lives in the
 * parent page. Extracted from `app/page.tsx` so the page stays under the
 * `max-lines` guardrail.
 *
 * @module app/_sections/ContactCardTurnstileModal
 */

import type { RefObject } from "react";
import { AlertCircle, Download, X } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

import { GlassPanel } from "@/components/ui/GlassPanel";

interface ContactCardTurnstileModalProps {
  isVerifying: boolean;
  verifiedToken: string | null;
  errorMessage: string | null;
  siteKey: string;
  theme: "light" | "dark";
  turnstileRef: RefObject<TurnstileInstance | null>;
  onClose: () => void;
  onSuccess: (token: string) => void;
  onError: () => void;
  onExpire: () => void;
  onManualDownload: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onRetry: () => void;
}

/**
 * Modal shell + stateful body for the contact-card download Turnstile flow.
 *
 * Renders one of four body states: verifying spinner, verified success +
 * fallback download link, active Turnstile challenge, or an inline error.
 */
export function ContactCardTurnstileModal({
  isVerifying,
  verifiedToken,
  errorMessage,
  siteKey,
  theme,
  turnstileRef,
  onClose,
  onSuccess,
  onError,
  onExpire,
  onManualDownload,
  onRetry,
}: ContactCardTurnstileModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <GlassPanel
        padding="lg"
        radius="2xl"
        className="max-w-md w-full mx-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isVerifying}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Only show header during Turnstile verification */}
        {!verifiedToken && (
          <div className="text-center mb-6">
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Verify You&apos;re Human
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Complete the verification below to download my contact card.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
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

        {isVerifying ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-600 dark:text-slate-300">Verifying...</p>
          </div>
        ) : verifiedToken ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
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
              </div>
              <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                Verification Complete!
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Your download will start automatically in a moment.
              </p>
            </div>
            {/* Always show fallback button in case auto-download fails */}
            <a
              href={`/api/contact-card?token=${encodeURIComponent(verifiedToken)}`}
              onClick={onManualDownload}
              className="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-slate-700 dark:text-slate-200 bg-slate-100/60 dark:bg-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-600/80 rounded-lg transition-all duration-200 backdrop-blur-sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Download didn&apos;t start? Click here
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center p-3 relative">
            {/* Solid background matching Turnstile theme */}
            <div className="absolute inset-0 rounded-lg bg-slate-100 dark:bg-[#262626]" />

            {/* Turnstile widget on top */}
            <div className="relative z-10">
              <Turnstile
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
          disabled={isVerifying}
          className="mt-4 w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
      </GlassPanel>
    </div>
  );
}
