/**
 * Shared base interfaces for PostHog analytics event properties.
 *
 * These bases pin the environment/source context required on every event and
 * the download-type discriminator shared by resume + vCard flows. Split out of
 * `types.ts` so the event-property modules can extend them without pulling in
 * the full `EventPropertiesMap` graph.
 *
 * @module lib/analytics/types-base
 */

import type { DownloadType, EnvType, SourceType } from "./events";

/**
 * Environment context required on ALL analytics events.
 *
 * `env` identifies the deployment (prod/preview/dev), `source` identifies the
 * emitter (web/api/script), and `is_server` tags whether the event was fired
 * from a server context.
 */
export interface AnalyticsBase {
  env: EnvType;
  source: SourceType;
  is_server: boolean;
}

/**
 * Base for all download-related events (resume + contact card).
 *
 * Adds the `download_type` discriminator so server+client handlers can branch
 * on vCard vs resume flows without inspecting other fields.
 */
export interface DownloadBase extends AnalyticsBase {
  download_type: DownloadType;
}
