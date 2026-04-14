/**
 * Resume download pipeline helpers.
 *
 * Pure-ish async functions that wrap the server endpoints + WASM PDF
 * generation used by the resume download flow. Extracted from
 * `ResumeDownload.tsx` so the main component stays focused on state and
 * layout.
 *
 * @module components/data/resume-download/pipeline
 */

import type { AIProvider } from "@/lib/ai/providers/types";
import type { SelectApiResponse } from "./types";

/**
 * Call the AI selection endpoint.
 *
 * Reads `retriesAttempted` from error bodies so the caller can show a
 * "retrying" state before throwing.
 *
 * @param params - Request parameters (job description, provider, Turnstile
 *   token, optional contact info, session id) plus an `onRetryAttempt`
 *   callback invoked when the server reports server-side retries.
 * @returns The decoded `SelectApiResponse`.
 * @throws Error with the server's `userMessage`/`message` on non-2xx.
 */
export async function fetchAIBullets(params: {
  jobDescription: string;
  provider: AIProvider;
  turnstileToken: string;
  email?: string;
  linkedin?: string;
  sessionId: string;
  onRetryAttempt: (count: number) => void;
}): Promise<SelectApiResponse> {
  const response = await fetch("/api/resume/ai-select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobDescription: params.jobDescription,
      provider: params.provider,
      turnstileToken: params.turnstileToken,
      email: params.email || undefined,
      linkedin: params.linkedin || undefined,
      sessionId: params.sessionId,
    }),
  });
  if (!response.ok) {
    const error = (await response.json()) as {
      retriesAttempted?: number;
      userMessage?: string;
      message?: string;
    };
    if (error.retriesAttempted && error.retriesAttempted > 0) {
      params.onRetryAttempt(error.retriesAttempted);
    }
    throw new Error(error.userMessage || error.message || "AI selection failed");
  }
  return (await response.json()) as SelectApiResponse;
}

/**
 * Call the heuristic selection endpoint.
 *
 * @param params - Role profile id, Turnstile token, optional contact info,
 *   session id.
 * @returns The decoded `SelectApiResponse`.
 * @throws Error with the server's `message` on non-2xx.
 */
export async function fetchHeuristicBullets(params: {
  roleProfileId: string;
  turnstileToken: string;
  email?: string;
  linkedin?: string;
  sessionId: string;
}): Promise<SelectApiResponse> {
  const response = await fetch("/api/resume/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roleProfileId: params.roleProfileId,
      turnstileToken: params.turnstileToken,
      email: params.email || undefined,
      linkedin: params.linkedin || undefined,
      sessionId: params.sessionId,
    }),
  });
  if (!response.ok) {
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message || "Failed to select bullets");
  }
  return (await response.json()) as SelectApiResponse;
}

/**
 * Inject the Typst WASM loader script (idempotent) and wait up to 10s for
 * `window.__wasmReady`.
 *
 * @returns Promise that resolves once WASM is ready on `window`.
 * @throws Error with a user-facing message on 10s timeout. Side-effects:
 *   appends a `<script type="module" data-wasm-loader>` tag to `document.head`
 *   if the module hasn't loaded yet.
 */
export async function ensureWasmLoaded(): Promise<void> {
  if (!window.__wasmReady) {
    console.warn("🔧 Loading WASM module...");
    const script = document.createElement("script");
    script.type = "module";
    script.setAttribute("data-wasm-loader", "true");
    script.textContent = `
      import init, { generate_pdf_typst, init_panic_hook, validate_payload_json } from '/wasm/resume_wasm.js';
      await init('/wasm/resume_wasm_bg.wasm');
      init_panic_hook();
      console.warn('✅ WASM loaded and cached');
      window.__wasmReady = true;
      window.__generatePdfTypst = generate_pdf_typst;
      window.__validatePayloadJson = validate_payload_json;
    `;
    document.head.appendChild(script);
  } else {
    console.warn("✅ WASM already loaded from cache");
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(checkReady);
      reject(new Error("WASM module failed to load — please refresh and try again"));
    }, 10000);
    const checkReady = setInterval(() => {
      if (window.__wasmReady) {
        clearInterval(checkReady);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
}

/**
 * Validate + compile the resume payload to a PDF byte array via WASM.
 *
 * @param payload - `GenerationPayload` produced by the selection pipeline.
 * @param isDevMode - Passes through to the Typst compiler's debug flag.
 * @returns The compiled PDF bytes as a `Uint8Array`.
 * @throws If validation fails or the Typst compiler is not initialised.
 */
export function generatePdfBytes(payload: unknown, isDevMode: boolean): Uint8Array {
  if (!window.__generatePdfTypst) {
    throw new Error("Typst WASM module not initialized");
  }
  const payloadJson = JSON.stringify(payload);
  console.warn("🔍 Validating payload...");
  if (window.__validatePayloadJson) {
    try {
      window.__validatePayloadJson(payloadJson);
      console.warn("✅ Payload validation passed");
    } catch (validationError) {
      console.error("❌ Payload validation failed:", validationError);
      throw new Error(`Invalid payload: ${validationError}`);
    }
  }
  console.warn("🎨 Generating PDF with Typst...");
  return window.__generatePdfTypst(payloadJson, isDevMode);
}

/**
 * Trigger a browser download for a PDF byte array and return the generated
 * filename so callers can log it.
 *
 * @param pdfBytes - PDF byte array from `generatePdfBytes`.
 * @param fullName - User's full name (used in the filename, spaces → `-`).
 * @param roleName - Role profile name (sluggified to 30 chars).
 * @returns The generated `.pdf` filename triggered for download.
 */
export function triggerPdfDownload(
  pdfBytes: Uint8Array,
  fullName: string,
  roleName: string,
): string {
  const blob = new Blob([pdfBytes.slice()], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeFullName = fullName.replace(/\s+/g, "-");
  const safeRoleName = roleName.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = `${safeFullName}-${safeRoleName}-${timestamp}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  return link.download;
}

/**
 * Fire-and-forget POST to `/api/resume/log` for generation/download/failure
 * events. Errors are logged to console; the promise is intentionally not
 * awaited so the UI stays responsive.
 *
 * @param body - JSON body; must include an `event` key naming the log entry.
 */
export function postLogEvent(body: Record<string, unknown>): void {
  fetch("/api/resume/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.error(`Failed to log ${body.event as string}:`, err));
}
