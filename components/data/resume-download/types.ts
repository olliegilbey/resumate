/**
 * Shared types + constants for the resume download flow.
 *
 * Split out of `ResumeDownload.tsx` so the stateful component, the selection
 * panel, the modal, and the pipeline helpers can all share a single type
 * vocabulary.
 *
 * @module components/data/resume-download/types
 */

import type { ResumeData } from "@/types/resume";

/** Minimum job-description length that unlocks AI-mode selection. */
export const MIN_JOB_DESCRIPTION_LENGTH = 50;

/** High-level status of the resume download flow. */
export type DownloadStatus = "idle" | "verifying" | "loading_wasm" | "generating" | "error";

/** Stage labels the download pipeline can fail at. */
export type DownloadErrorStage =
  | "bullet_selection"
  | "ai_selection"
  | "wasm_load"
  | "pdf_generation";

/** Props accepted by the top-level `ResumeDownload` component. */
export interface ResumeDownloadProps {
  resumeData: ResumeData;
}

/**
 * Shape of the API responses from `/api/resume/select` and
 * `/api/resume/ai-select`.
 */
export interface SelectApiResponse {
  selected: Array<{
    bullet: { id: string; description: string };
    companyId: string;
    positionId: string;
  }>;
  reasoning?: string;
  jobTitle?: string | null;
  salary?: { min?: number; max?: number; currency: string; period: string } | null;
  metadata?: { provider: string; tokensUsed?: number; duration?: number };
}

// Extend Window interface for WASM functions
declare global {
  interface Window {
    __wasmReady?: boolean;
    __generatePdf?: (payload: string, devMode: boolean) => Uint8Array;
    __generatePdfTypst?: (payload: string, devMode: boolean) => Uint8Array;
    __validatePayloadJson?: (json: string) => void;
  }
}
