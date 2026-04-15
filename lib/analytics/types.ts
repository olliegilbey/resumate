/**
 * PostHog Analytics Event Property Types
 *
 * Thin aggregator: re-exports the base interfaces and per-event property types
 * from the split modules, and defines the {@link EventPropertiesMap} used for
 * type-safe event tracking.
 *
 * All event property interfaces per spec `docs/POSTHOG_DASHBOARD_SPEC.md`
 * Section 6. Import from here for type-safe event tracking.
 *
 * @module lib/analytics/types
 */

export type { AnalyticsBase, DownloadBase } from "./types-base";
export type {
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
} from "./event-properties-client";
export type {
  ContactCardServedProperties,
  ResumePreparedProperties,
  ResumeGeneratedProperties,
  ResumeDownloadNotifiedProperties,
  ResumeFailedProperties,
} from "./event-properties-server";

import type {
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
} from "./event-properties-client";
import type {
  ContactCardServedProperties,
  ResumePreparedProperties,
  ResumeGeneratedProperties,
  ResumeDownloadNotifiedProperties,
  ResumeFailedProperties,
} from "./event-properties-server";

/**
 * Map of event names to their property types.
 * Used for type-safe event tracking.
 */
export interface EventPropertiesMap {
  // Explorer
  tag_filter_changed: TagFilterChangedProperties;
  search_performed: SearchPerformedProperties;
  // Contact Card
  contact_card_initiated: ContactCardInitiatedProperties;
  contact_card_verified: ContactCardVerifiedProperties;
  contact_card_downloaded: ContactCardDownloadedProperties;
  contact_card_error: ContactCardErrorProperties;
  contact_card_cancelled: ContactCardCancelledProperties;
  contact_card_served: ContactCardServedProperties;
  // Resume - Client
  resume_initiated: ResumeInitiatedProperties;
  resume_verified: ResumeVerifiedProperties;
  resume_compiled: ResumeCompiledProperties;
  resume_downloaded: ResumeDownloadedProperties;
  resume_error: ResumeErrorProperties;
  resume_cancelled: ResumeCancelledProperties;
  // Resume - Server
  resume_prepared: ResumePreparedProperties;
  resume_generated: ResumeGeneratedProperties;
  resume_download_notified: ResumeDownloadNotifiedProperties;
  resume_failed: ResumeFailedProperties;
}
