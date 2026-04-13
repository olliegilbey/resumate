"use client";

/**
 * PostHog provider + generic `useTrackEvent` hook.
 *
 * Wires the PostHog browser SDK into the React tree via the proxy path and
 * exposes a single typed `useTrackEvent` helper for ad-hoc captures. Product
 * funnel hooks (`usePostHogResume`, `usePostHogContactCard`) live in
 * `lib/posthog-hooks.tsx`; event type definitions live in `lib/posthog-events.ts`.
 *
 * @module lib/posthog-client
 */

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useCallback, useMemo } from "react";

import { getClientEnvironmentContext } from "@/lib/analytics/events";
import type {
  AIProvider,
  CancelStage,
  DownloadType,
  ErrorCategory,
  ErrorStage,
  GenerationMethod,
} from "@/lib/analytics/events";
import type { ClientAnalyticsEvent, EventProperties } from "@/lib/posthog-events";

// Re-export enum-shaped types for consumers
export type { DownloadType, GenerationMethod, AIProvider, ErrorStage, ErrorCategory, CancelStage };

// Re-export client event types so existing imports from this module keep working
export type {
  ClientAnalyticsEvent,
  TagFilterChangedProperties,
  SearchPerformedProperties,
  ContactCardInitiatedProperties,
  ContactCardVerifiedProperties,
  ContactCardDownloadedProperties,
  ContactCardErrorProperties,
  ContactCardCancelledProperties,
  ResumeInitiatedProperties,
  ResumeVerifiedProperties,
  ResumeCompiledProperties,
  ResumeDownloadedProperties,
  ResumeErrorProperties,
  ResumeCancelledProperties,
} from "@/lib/posthog-events";

// Re-export funnel hooks so existing imports from this module keep working
export { usePostHogResume, usePostHogContactCard } from "@/lib/posthog-hooks";

/**
 * Hook for tracking client-side analytics events.
 * Events go direct to PostHog via Next.js proxy (/api/_lib).
 * Automatically injects environment context (env, source, is_server).
 * Gracefully handles missing PostHog (dev without key).
 */
export function useTrackEvent() {
  const posthogClient = usePostHog();
  const envContext = useMemo(() => getClientEnvironmentContext(), []);

  return useCallback(
    <E extends ClientAnalyticsEvent>(event: E, properties: EventProperties[E]) => {
      posthogClient?.capture(event, { ...envContext, ...properties });
    },
    [posthogClient, envContext],
  );
}

/**
 * React context provider that initialises PostHog and wraps children.
 *
 * Skips initialisation (and the underlying provider) when the public key is
 * missing so local dev without PostHog keeps rendering fine.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  useEffect(() => {
    // Guard: Skip init if key is missing (local/dev envs)
    if (!posthogKey) {
      console.warn("[PostHog] Key missing, analytics disabled");
      return;
    }

    try {
      posthog.init(posthogKey, {
        api_host: "/api/_lib",
        ui_host: "https://eu.posthog.com",
        person_profiles: "identified_only",
        defaults: "2025-05-24",
        autocapture: false, // Explicit events only - no input/click noise
        capture_pageview: true,
        capture_pageleave: true,
        debug: process.env.NODE_ENV === "development",
      });
    } catch (error) {
      console.error("[PostHog] Init failed:", error);
    }
  }, [posthogKey]);

  // Skip provider wrapper if key is missing
  if (!posthogKey) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
