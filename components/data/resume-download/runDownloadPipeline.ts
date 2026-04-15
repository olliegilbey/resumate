/**
 * Resume download end-to-end pipeline runner.
 *
 * Orchestrates the post-verification flow: obtain a session id, fetch
 * selected bullets (AI or heuristic), load WASM, compile the PDF, fire all
 * analytics + server logs, and trigger the browser download. Extracted from
 * `useDownloadExecution.ts` so the hook body stays focused on React state
 * wiring.
 *
 * @module components/data/resume-download/runDownloadPipeline
 */

import type { ResumeData, RoleProfile } from "@/types/resume";
import type { AIProvider } from "@/lib/ai/providers/types";
import type { usePostHogResume } from "@/lib/posthog-client";
import type { AIProgressStage } from "@/components/ui/AIProgressIndicator";
import {
  ensureWasmLoaded,
  fetchAIBullets,
  fetchHeuristicBullets,
  generatePdfBytes,
  postLogEvent,
  triggerPdfDownload,
} from "./pipeline";
import type { DownloadErrorStage, DownloadStatus, SelectApiResponse } from "./types";

type Analytics = ReturnType<typeof usePostHogResume>;

/** Mutable reference the pipeline uses to stamp the failure stage. */
export interface ErrorStageRef {
  current: DownloadErrorStage;
}

/**
 * Context bag passed to {@link runDownloadPipeline}.
 *
 * Groups the pure inputs (mode flags, form values, analytics, resume data)
 * with the React state setters the pipeline needs to drive the UI forward.
 */
export interface PipelineContext {
  isAIMode: boolean;
  verifiedToken: string;
  jobDescription: string;
  aiProvider: AIProvider;
  selectedRoleId: string;
  roleProfiles: readonly RoleProfile[];
  resumeData: ResumeData;
  email: string;
  linkedin: string;
  analytics: Analytics;
  flowStartMs: number;
  errorStageRef: ErrorStageRef;
  setStatus: (value: DownloadStatus) => void;
  setAiStage: (value: AIProgressStage) => void;
  setAiRetryCount: (value: number) => void;
  closeModal: () => void;
}

/** Fetch curated bullets for either AI or heuristic mode. */
async function fetchSelection(ctx: PipelineContext, sessionId: string): Promise<SelectApiResponse> {
  const { isAIMode, verifiedToken, email, linkedin } = ctx;

  ctx.setStatus("loading_wasm");
  if (isAIMode) {
    ctx.setAiStage("analyzing");
    console.warn(`🤖 AI Selection with ${ctx.aiProvider}...`);
    ctx.setAiStage("selecting");
    const data = await fetchAIBullets({
      jobDescription: ctx.jobDescription.trim(),
      provider: ctx.aiProvider,
      turnstileToken: verifiedToken,
      email,
      linkedin,
      sessionId,
      onRetryAttempt: (count) => {
        ctx.setAiRetryCount(count);
        ctx.setAiStage("retrying");
      },
    });
    ctx.setAiStage("validating");
    console.warn(`✅ AI selected ${data.selected.length} bullets`);
    return data;
  }
  return fetchHeuristicBullets({
    roleProfileId: ctx.selectedRoleId,
    turnstileToken: verifiedToken,
    email,
    linkedin,
    sessionId,
  });
}

/**
 * Build the role profile used to label the generated PDF.
 *
 * AI mode: synthesize a profile from the inferred job title. Heuristic mode:
 * look up the user-selected profile. Throws if the heuristic profile is
 * missing (should never happen for valid inputs).
 */
function resolveRoleProfile(ctx: PipelineContext, selectData: SelectApiResponse): RoleProfile {
  if (ctx.isAIMode) {
    return {
      id: "ai-curated",
      name: selectData.jobTitle || "AI-Curated Resume",
      description: "AI-selected based on job description",
      tagWeights: {},
      scoringWeights: { tagRelevance: 0.5, priority: 0.5 },
    };
  }
  const profile = ctx.roleProfiles.find((r) => r.id === ctx.selectedRoleId);
  if (!profile) throw new Error("Role profile not found");
  return profile;
}

/**
 * Run the complete post-verification download pipeline.
 *
 * Orchestrates: bullet selection → WASM load → PDF generation → download →
 * analytics + server logging → modal close. Callers pass in their analytics
 * hook, state setters, and an `errorStageRef` so the taxonomy stage is
 * stamped at each step before awaits.
 *
 * @param ctx - Pipeline context: state, setters, analytics callbacks, session
 *   identifiers, and the error-stage ref.
 * @returns Promise that resolves after the PDF download has been triggered.
 *   Rejects with the underlying error on any stage failure so the caller can
 *   surface error analytics.
 * @example
 * ```ts
 * try {
 *   await runDownloadPipeline(ctx);
 * } catch (err) {
 *   // ctx.errorStageRef.current now names the failed stage
 * }
 * ```
 */
export async function runDownloadPipeline(ctx: PipelineContext): Promise<void> {
  const startTime = Date.now();

  const sessionId = sessionStorage.getItem("resumate_session") || crypto.randomUUID();
  sessionStorage.setItem("resumate_session", sessionId);

  const selectData = await fetchSelection(ctx, sessionId);

  ctx.errorStageRef.current = "wasm_load";
  const wasmLoadStart = Date.now();
  const wasmCached = Boolean(window.__wasmReady);
  ctx.setStatus("generating");
  if (ctx.isAIMode) ctx.setAiStage("compiling");
  await ensureWasmLoaded();
  const wasmLoadDuration = Date.now() - wasmLoadStart;

  ctx.errorStageRef.current = "pdf_generation";
  const roleProfile = resolveRoleProfile(ctx, selectData);
  const payload = {
    personal: ctx.resumeData.personal,
    selectedBullets: selectData.selected,
    roleProfile,
    education: ctx.resumeData.education,
    skills: ctx.resumeData.skills,
    summary: ctx.resumeData.summary,
    metadata: null,
  };
  const generationStart = Date.now();
  const pdfBytes = generatePdfBytes(payload, process.env.NODE_ENV === "development");
  const generationDuration = Date.now() - generationStart;
  console.warn("✅ PDF generated successfully with Typst");

  const totalDuration = Date.now() - startTime;
  if (ctx.isAIMode) ctx.setAiStage("complete");

  ctx.analytics.compiled({
    generation_method: ctx.isAIMode ? "ai" : "heuristic",
    download_type: ctx.isAIMode ? "resume_ai" : "resume_heuristic",
    role_profile_id: ctx.isAIMode ? undefined : ctx.selectedRoleId,
    ai_provider: ctx.isAIMode ? ctx.aiProvider : undefined,
    bullet_count: selectData.selected.length,
    wasm_load_ms: wasmLoadDuration,
    wasm_cached: wasmCached,
    generation_ms: generationDuration,
    pdf_size_bytes: pdfBytes.length,
    ai_response_ms: ctx.isAIMode ? selectData.metadata?.duration : undefined,
  });

  postLogEvent({
    event: "resume_generated",
    sessionId,
    roleProfileId: ctx.isAIMode ? "ai-curated" : ctx.selectedRoleId,
    roleProfileName: roleProfile.name,
    bulletCount: selectData.selected.length,
    pdfSize: pdfBytes.length,
    wasmLoadDuration,
    generationDuration,
    totalDuration,
    wasmCached,
    ...(ctx.isAIMode && {
      generation_method: "ai",
      ai_provider: ctx.aiProvider,
      job_title: selectData.jobTitle,
      reasoning: selectData.reasoning,
    }),
  });

  const fullName = (ctx.resumeData.personal.fullName as string | undefined) || "resume";
  const filename = triggerPdfDownload(pdfBytes, fullName, roleProfile.name);

  ctx.analytics.downloaded({
    generation_method: ctx.isAIMode ? "ai" : "heuristic",
    download_type: ctx.isAIMode ? "resume_ai" : "resume_heuristic",
    role_profile_id: ctx.isAIMode ? undefined : ctx.selectedRoleId,
    role_profile_name: ctx.isAIMode ? undefined : roleProfile.name,
    ai_provider: ctx.isAIMode ? ctx.aiProvider : undefined,
    job_title: ctx.isAIMode ? selectData.jobTitle : undefined,
    bullet_count: selectData.selected.length,
    total_duration_ms: Date.now() - ctx.flowStartMs,
  });

  postLogEvent({
    event: "resume_download_notified",
    sessionId,
    roleProfileId: ctx.isAIMode ? "ai-curated" : ctx.selectedRoleId,
    roleProfileName: roleProfile.name,
    email: ctx.email || undefined,
    linkedin: ctx.linkedin || undefined,
    bulletCount: selectData.selected.length,
    bullets: selectData.selected,
    pdfSize: pdfBytes.length,
    filename,
    ...(ctx.isAIMode && {
      generation_method: "ai",
      ai_provider: ctx.aiProvider,
      job_description: ctx.jobDescription.trim(),
      job_title: selectData.jobTitle,
      salary: selectData.salary,
      reasoning: selectData.reasoning,
    }),
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  setTimeout(ctx.closeModal, 1500);
}
