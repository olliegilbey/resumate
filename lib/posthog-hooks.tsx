"use client";

/**
 * Client-side PostHog funnel hooks.
 *
 * Hosts the two product-specific hooks (`usePostHogResume`,
 * `usePostHogContactCard`) that wrap `useTrackEvent` with pre-typed capture
 * helpers for each funnel step. Extracted from `lib/posthog-client.tsx` so the
 * provider module stays under the `max-lines` guardrail.
 *
 * @module lib/posthog-hooks
 */

import { usePostHog } from "posthog-js/react";
import { useCallback, useMemo } from "react";

import { ANALYTICS_EVENTS, getClientEnvironmentContext } from "@/lib/analytics/events";
import type {
  ClientAnalyticsEvent,
  ContactCardCancelledProperties,
  ContactCardDownloadedProperties,
  ContactCardErrorProperties,
  ContactCardInitiatedProperties,
  ContactCardVerifiedProperties,
  EventProperties,
  ResumeCancelledProperties,
  ResumeCompiledProperties,
  ResumeDownloadedProperties,
  ResumeErrorProperties,
  ResumeInitiatedProperties,
  ResumeVerifiedProperties,
} from "@/lib/posthog-events";

/**
 * Hook for tracking resume download funnel.
 * Client-side for accurate GeoIP (server-side gives inaccurate location).
 *
 * Funnel: initiated -> verified -> compiled -> downloaded
 * Supports both heuristic (role profile) and AI (job description) modes.
 * Error/cancelled events for drop-off analysis.
 *
 * All events include environment context (env, source, is_server: false).
 */
export function usePostHogResume() {
  const posthogClient = usePostHog();
  const envContext = useMemo(() => getClientEnvironmentContext(), []);

  const track = useCallback(
    <E extends Extract<ClientAnalyticsEvent, `resume_${string}`>>(
      event: E,
      properties: EventProperties[E],
    ) => {
      posthogClient?.capture(event, { ...envContext, ...properties });
    },
    [posthogClient, envContext],
  );

  return {
    /** Track download button click (before Turnstile) */
    initiated: useCallback(
      (props: ResumeInitiatedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_INITIATED as "resume_initiated", props),
      [track],
    ),
    /** Track Turnstile verification complete */
    verified: useCallback(
      (props: ResumeVerifiedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_VERIFIED as "resume_verified", props),
      [track],
    ),
    /** Track WASM compilation complete with timing metrics */
    compiled: useCallback(
      (props: ResumeCompiledProperties) =>
        track(ANALYTICS_EVENTS.RESUME_COMPILED as "resume_compiled", props),
      [track],
    ),
    /** Track successful download trigger */
    downloaded: useCallback(
      (props: ResumeDownloadedProperties) =>
        track(ANALYTICS_EVENTS.RESUME_DOWNLOADED as "resume_downloaded", props),
      [track],
    ),
    /** Track any error in the flow */
    error: useCallback(
      (props: ResumeErrorProperties) =>
        track(ANALYTICS_EVENTS.RESUME_ERROR as "resume_error", props),
      [track],
    ),
    /** Track user cancellation */
    cancelled: useCallback(
      (props: ResumeCancelledProperties) =>
        track(ANALYTICS_EVENTS.RESUME_CANCELLED as "resume_cancelled", props),
      [track],
    ),
  };
}

/**
 * Hook for tracking contact card download funnel.
 * All events include environment context (env, source, is_server: false).
 */
export function usePostHogContactCard() {
  const posthogClient = usePostHog();
  const envContext = useMemo(() => getClientEnvironmentContext(), []);

  const track = useCallback(
    <E extends Extract<ClientAnalyticsEvent, `contact_card_${string}`>>(
      event: E,
      properties: EventProperties[E],
    ) => {
      posthogClient?.capture(event, { ...envContext, ...properties });
    },
    [posthogClient, envContext],
  );

  return {
    /** Track download button click (before Turnstile) */
    initiated: useCallback(
      (props: ContactCardInitiatedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_INITIATED as "contact_card_initiated", props),
      [track],
    ),
    /** Track Turnstile verification complete */
    verified: useCallback(
      (props: ContactCardVerifiedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_VERIFIED as "contact_card_verified", props),
      [track],
    ),
    /** Track successful download */
    downloaded: useCallback(
      (props: ContactCardDownloadedProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_DOWNLOADED as "contact_card_downloaded", props),
      [track],
    ),
    /** Track any error in the flow */
    error: useCallback(
      (props: ContactCardErrorProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_ERROR as "contact_card_error", props),
      [track],
    ),
    /** Track user cancellation */
    cancelled: useCallback(
      (props: ContactCardCancelledProperties) =>
        track(ANALYTICS_EVENTS.CONTACT_CARD_CANCELLED as "contact_card_cancelled", props),
      [track],
    ),
  };
}
