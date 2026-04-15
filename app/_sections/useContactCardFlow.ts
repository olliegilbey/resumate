"use client";

/**
 * Contact-card download flow state hook.
 *
 * Owns all landing-page Turnstile + download state (open/verified/error),
 * timing refs for funnel analytics, and the handlers wired to the modal.
 * Extracted from `app/page.tsx` so the page component stays thin.
 *
 * @module app/_sections/useContactCardFlow
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { type TurnstileInstance } from "@marsidev/react-turnstile";

import { useTrackEvent } from "@/lib/posthog-client";

/**
 * Internal helper: fire a hidden anchor to start the contact-card download.
 */
function triggerDownload(verifiedToken: string) {
  const link = document.createElement("a");
  link.href = `/api/contact-card?token=${encodeURIComponent(verifiedToken)}`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * React hook that drives the contact-card Turnstile funnel on the landing page.
 *
 * Exposes the modal-visible state, the Turnstile instance ref, and the full
 * set of handlers the modal needs (success/error/expire/close/manual-download/
 * retry) plus `openModal` for the page's primary CTA. Emits the
 * `contact_card_*` analytics events at each funnel step.
 *
 * @returns Modal state + handlers consumed by `app/page.tsx` and
 *   `ContactCardTurnstileModal`.
 */
export function useContactCardFlow() {
  const [showTurnstileModal, setShowTurnstileModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadInitiated, setDownloadInitiated] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const autoDownloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  const trackEvent = useTrackEvent();
  const flowStartTimeRef = useRef<number | null>(null);
  const verifiedTimeRef = useRef<number | null>(null);

  const openModal = () => {
    const now = Date.now();
    flowStartTimeRef.current = now;
    verifiedTimeRef.current = null;

    trackEvent("contact_card_initiated", {
      download_type: "vcard",
      timestamp: now,
    });

    setShowTurnstileModal(true);
    setVerifiedToken(null);
    setErrorMessage(null);
    setDownloadInitiated(false);
  };

  const handleTurnstileSuccess = (token: string) => {
    console.warn("Turnstile verified, token ready");
    const now = Date.now();
    verifiedTimeRef.current = now;

    if (flowStartTimeRef.current) {
      trackEvent("contact_card_verified", {
        download_type: "vcard",
        turnstile_duration_ms: now - flowStartTimeRef.current,
      });
    }

    setVerifiedToken(token);
    setIsVerifying(false);
    setErrorMessage(null);
  };

  const handleManualDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (autoDownloadTimerRef.current) {
      clearTimeout(autoDownloadTimerRef.current);
      autoDownloadTimerRef.current = null;
    }

    if (downloadInitiated) return;

    setDownloadInitiated(true);

    if (verifiedToken) {
      if (flowStartTimeRef.current) {
        trackEvent("contact_card_downloaded", {
          download_type: "vcard",
          total_duration_ms: Date.now() - flowStartTimeRef.current,
        });
      }
      triggerDownload(verifiedToken);
    }

    setTimeout(() => {
      flowStartTimeRef.current = null;
      verifiedTimeRef.current = null;
      setShowTurnstileModal(false);
      setVerifiedToken(null);
      setErrorMessage(null);
      setDownloadInitiated(false);
    }, 1000);
  };

  const handleCloseModal = useCallback(() => {
    if (isVerifying) return;

    if (autoDownloadTimerRef.current) {
      clearTimeout(autoDownloadTimerRef.current);
      autoDownloadTimerRef.current = null;
    }

    if (flowStartTimeRef.current) {
      trackEvent("contact_card_cancelled", {
        download_type: "vcard",
        stage: verifiedTimeRef.current ? "verified" : "turnstile",
        duration_ms: Date.now() - flowStartTimeRef.current,
      });
      flowStartTimeRef.current = null;
      verifiedTimeRef.current = null;
    }

    setShowTurnstileModal(false);
    setVerifiedToken(null);
    setErrorMessage(null);
    setDownloadInitiated(false);
    turnstileRef.current?.reset();
  }, [isVerifying, trackEvent]);

  const handleTurnstileError = useCallback(() => {
    if (flowStartTimeRef.current) {
      trackEvent("contact_card_error", {
        download_type: "vcard",
        error_code: "TN_001",
        error_category: "turnstile",
        error_stage: "turnstile",
        error_message: "Turnstile verification failed",
        is_retryable: true,
        duration_ms: Date.now() - flowStartTimeRef.current,
      });
    }
    setErrorMessage("Verification failed. Please try again.");
    setIsVerifying(false);
  }, [trackEvent]);

  const handleTurnstileExpire = useCallback(() => {
    if (flowStartTimeRef.current) {
      trackEvent("contact_card_error", {
        download_type: "vcard",
        error_code: "TN_002",
        error_category: "turnstile",
        error_stage: "turnstile",
        error_message: "Turnstile verification expired",
        is_retryable: true,
        duration_ms: Date.now() - flowStartTimeRef.current,
      });
    }
    setErrorMessage("Verification expired. Please refresh and try again.");
    setIsVerifying(false);
    setVerifiedToken(null);
  }, [trackEvent]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    turnstileRef.current?.reset();
  }, []);

  // Auto-download when token is verified (with slight delay for UX)
  useEffect(() => {
    if (verifiedToken && !downloadInitiated) {
      console.warn("Auto-triggering download...");
      const timer = setTimeout(async () => {
        setDownloadInitiated(true);
        if (flowStartTimeRef.current) {
          trackEvent("contact_card_downloaded", {
            download_type: "vcard",
            total_duration_ms: Date.now() - flowStartTimeRef.current,
          });
        }
        triggerDownload(verifiedToken);
        await new Promise((resolve) => setTimeout(resolve, 500));
        setTimeout(() => {
          flowStartTimeRef.current = null;
          verifiedTimeRef.current = null;
          setShowTurnstileModal(false);
          setVerifiedToken(null);
          setErrorMessage(null);
          setDownloadInitiated(false);
        }, 1500);
      }, 300);

      autoDownloadTimerRef.current = timer;
      return () => {
        clearTimeout(timer);
        autoDownloadTimerRef.current = null;
      };
    }
  }, [verifiedToken, downloadInitiated, trackEvent]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showTurnstileModal && !isVerifying) {
        handleCloseModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showTurnstileModal, isVerifying, handleCloseModal]);

  return {
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
  };
}
