import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDownloadExecution } from "../useDownloadExecution";
import type { PipelineContext } from "../runDownloadPipeline";
import type { ResumeData, RoleProfile } from "@/types/resume";

/**
 * Unit tests for {@link useDownloadExecution}.
 *
 * Verifies that the three error taxonomy fields (`error_code`, `error_category`,
 * `is_retryable`) are forwarded to `postLogEvent` on pipeline failure. These
 * fields are dropped in the original code, breaking server-side failure grouping.
 *
 * Strategy: mock both `./runDownloadPipeline` and `./pipeline` so we can force
 * a throw at a known error stage and inspect the `postLogEvent` payload.
 */

// ---- Mocks ---------------------------------------------------------------

const mockRunDownloadPipeline = vi.fn();
const mockPostLogEvent = vi.fn();

vi.mock("../runDownloadPipeline", () => ({
  runDownloadPipeline: (...args: unknown[]) => mockRunDownloadPipeline(...args),
}));

vi.mock("../pipeline", () => ({
  postLogEvent: (...args: unknown[]) => mockPostLogEvent(...args),
}));

// ---- Fixtures ------------------------------------------------------------

const heuristicRoleProfile: RoleProfile = {
  id: "developer-relations-lead",
  name: "Developer Relations Lead",
  description: "DevRel leadership role",
  tagWeights: {},
  scoringWeights: { tagRelevance: 0.5, priority: 0.5 },
};

const resumeData = {
  personal: { fullName: "Jane Doe" },
  education: [],
  skills: [],
  summary: "Summary",
  experience: [],
  roleProfiles: [heuristicRoleProfile],
  metadata: { version: "1.0", compendiumVersion: "1.0", lastUpdated: "2025-01-01" },
} as unknown as ResumeData;

function makeAnalytics() {
  return {
    initiated: vi.fn(),
    verified: vi.fn(),
    compiled: vi.fn(),
    downloaded: vi.fn(),
    error: vi.fn(),
    cancelled: vi.fn(),
  };
}

/** Build minimal params; most setters are stubs. */
function makeParams(
  overrides: Partial<Parameters<typeof useDownloadExecution>[0]> = {},
): Parameters<typeof useDownloadExecution>[0] {
  return {
    verifiedToken: "ts-token",
    downloadInitiated: false,
    status: "idle",
    jobDescription: "", // short → heuristic (isAIMode = false)
    aiProvider: "claude-sonnet",
    selectedRoleId: heuristicRoleProfile.id,
    roleProfiles: [heuristicRoleProfile],
    resumeData,
    email: "user@example.com",
    linkedin: "",
    analytics: makeAnalytics() as unknown as Parameters<
      typeof useDownloadExecution
    >[0]["analytics"],
    flowStartRef: { current: Date.now() - 500 },
    setDownloadInitiated: vi.fn(),
    setStatus: vi.fn(),
    setAiStage: vi.fn(),
    setAiRetryCount: vi.fn(),
    setErrorMessage: vi.fn(),
    setVerifiedToken: vi.fn(),
    setEmail: vi.fn(),
    setLinkedin: vi.fn(),
    setShowTurnstile: vi.fn(),
    ...overrides,
  };
}

// ---- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  sessionStorage.clear();
  // Needed so the `if (sessionId)` guard in the catch block passes.
  sessionStorage.setItem("resumate_session", "test-session");
});

afterEach(() => {
  vi.useRealTimers();
});

// ---- Tests ---------------------------------------------------------------

describe("useDownloadExecution — error taxonomy forwarded to postLogEvent", () => {
  it("sends error_code / error_category / is_retryable on heuristic failure (bullet_selection)", async () => {
    // Pipeline immediately rejects; hook pre-stamps bullet_selection → AI_001.
    mockRunDownloadPipeline.mockRejectedValueOnce(new Error("selection boom"));

    renderHook(() => useDownloadExecution(makeParams()));

    // Advance past the 300 ms setTimeout that wraps the pipeline call.
    await vi.advanceTimersByTimeAsync(300);

    expect(mockPostLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "resume_failed",
        error_code: "AI_001",
        error_category: "ai",
        is_retryable: true,
      }),
    );
  });

  it("sends error_code / error_category / is_retryable on WASM failure (wasm_load)", async () => {
    // Pipeline stamps wasm_load on the shared errorStageRef before throwing.
    mockRunDownloadPipeline.mockImplementationOnce(async (ctx: PipelineContext) => {
      ctx.errorStageRef.current = "wasm_load";
      throw new Error("wasm boom");
    });

    renderHook(() => useDownloadExecution(makeParams()));
    await vi.advanceTimersByTimeAsync(300);

    expect(mockPostLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "resume_failed",
        error_code: "WM_001",
        error_category: "wasm",
        is_retryable: true,
      }),
    );
  });

  it("sends error_code / error_category / is_retryable on PDF failure (pdf_generation, non-retryable)", async () => {
    // Pipeline stamps pdf_generation; mapErrorToTaxonomy returns retryable: false.
    mockRunDownloadPipeline.mockImplementationOnce(async (ctx: PipelineContext) => {
      ctx.errorStageRef.current = "pdf_generation";
      throw new Error("pdf boom");
    });

    renderHook(() => useDownloadExecution(makeParams()));
    await vi.advanceTimersByTimeAsync(300);

    expect(mockPostLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "resume_failed",
        error_code: "PDF_001",
        error_category: "pdf",
        is_retryable: false,
      }),
    );
  });
});
