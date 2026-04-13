import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDownloadPipeline } from "../runDownloadPipeline";
import type { ResumeData, RoleProfile } from "@/types/resume";
import type { SelectApiResponse } from "../types";

/**
 * Unit tests for {@link runDownloadPipeline}.
 *
 * The pipeline is pure-ish: fetches + WASM + DOM side-effects are all mocked
 * via `vi.mock`. These tests pin the orchestration contract — what gets
 * called, in what order, with which arguments — so future refactors can't
 * silently drop a stage.
 */

// ---- Mocks ---------------------------------------------------------------

const mockFetchAIBullets = vi.fn();
const mockFetchHeuristicBullets = vi.fn();
const mockEnsureWasmLoaded = vi.fn();
const mockGeneratePdfBytes = vi.fn();
const mockPostLogEvent = vi.fn();
const mockTriggerPdfDownload = vi.fn();

vi.mock("../pipeline", () => ({
  fetchAIBullets: (...args: unknown[]) => mockFetchAIBullets(...args),
  fetchHeuristicBullets: (...args: unknown[]) => mockFetchHeuristicBullets(...args),
  ensureWasmLoaded: (...args: unknown[]) => mockEnsureWasmLoaded(...args),
  generatePdfBytes: (...args: unknown[]) => mockGeneratePdfBytes(...args),
  postLogEvent: (...args: unknown[]) => mockPostLogEvent(...args),
  triggerPdfDownload: (...args: unknown[]) => mockTriggerPdfDownload(...args),
}));

// ---- Fixtures ------------------------------------------------------------

const heuristicRoleProfile: RoleProfile = {
  id: "developer-relations-lead",
  name: "Developer Relations Lead",
  description: "DevRel leadership role",
  tagWeights: {},
  scoringWeights: { tagRelevance: 0.5, priority: 0.5 },
};

const selectResponse: SelectApiResponse = {
  selected: [
    {
      bullet: { id: "b1", description: "Led community growth 3x" },
      companyId: "c1",
      positionId: "p1",
    },
  ],
  jobTitle: "Head of DevRel",
  metadata: { provider: "anthropic", duration: 1200 },
};

const resumeData: ResumeData = {
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

type Analytics = ReturnType<typeof makeAnalytics>;

function makeCtx(
  overrides: Partial<Parameters<typeof runDownloadPipeline>[0]> = {},
  analytics?: Analytics,
) {
  return {
    isAIMode: false,
    verifiedToken: "ts-token",
    jobDescription: "",
    aiProvider: "claude-sonnet" as const,
    selectedRoleId: heuristicRoleProfile.id,
    roleProfiles: [heuristicRoleProfile],
    resumeData,
    email: "user@example.com",
    linkedin: "linkedin.com/in/jane",
    analytics: (analytics ?? makeAnalytics()) as unknown as Parameters<
      typeof runDownloadPipeline
    >[0]["analytics"],
    flowStartMs: Date.now() - 500,
    errorStageRef: { current: "bullet_selection" as const },
    setStatus: vi.fn(),
    setAiStage: vi.fn(),
    setAiRetryCount: vi.fn(),
    closeModal: vi.fn(),
    ...overrides,
  };
}

// ---- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  sessionStorage.clear();

  mockFetchAIBullets.mockResolvedValue(selectResponse);
  mockFetchHeuristicBullets.mockResolvedValue(selectResponse);
  mockEnsureWasmLoaded.mockResolvedValue(undefined);
  mockGeneratePdfBytes.mockReturnValue(new Uint8Array([1, 2, 3, 4]));
  mockTriggerPdfDownload.mockReturnValue("jane-doe-developer-relations-lead.pdf");
});

// Helper: advance past the two trailing setTimeouts (500ms + 1500ms).
async function finishPipeline(promise: Promise<void>) {
  await vi.advanceTimersByTimeAsync(500);
  await promise;
  await vi.advanceTimersByTimeAsync(1500);
}

// ---- Tests ---------------------------------------------------------------

describe("runDownloadPipeline", () => {
  describe("heuristic mode", () => {
    it("runs: fetchHeuristic → wasm → pdf → downloaded, fires analytics + logs", async () => {
      const analytics = makeAnalytics();
      const ctx = makeCtx({ isAIMode: false }, analytics);

      const promise = runDownloadPipeline(ctx);
      await finishPipeline(promise);

      expect(mockFetchHeuristicBullets).toHaveBeenCalledOnce();
      expect(mockFetchAIBullets).not.toHaveBeenCalled();
      expect(mockEnsureWasmLoaded).toHaveBeenCalledOnce();
      expect(mockGeneratePdfBytes).toHaveBeenCalledOnce();
      expect(mockTriggerPdfDownload).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        "Jane Doe",
        "Developer Relations Lead",
      );

      expect(analytics.compiled).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_method: "heuristic",
          download_type: "resume_heuristic",
          role_profile_id: "developer-relations-lead",
          bullet_count: 1,
          pdf_size_bytes: 4,
        }),
      );
      expect(analytics.downloaded).toHaveBeenCalledWith(
        expect.objectContaining({ generation_method: "heuristic", bullet_count: 1 }),
      );

      expect(mockPostLogEvent).toHaveBeenCalledTimes(2);
      expect(mockPostLogEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ event: "resume_generated" }),
      );
      expect(mockPostLogEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ event: "resume_download_notified" }),
      );
    });

    it("reuses the existing session id when one is cached", async () => {
      sessionStorage.setItem("resumate_session", "cached-session-id");
      const ctx = makeCtx({ isAIMode: false });

      const promise = runDownloadPipeline(ctx);
      await finishPipeline(promise);

      expect(mockFetchHeuristicBullets).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "cached-session-id" }),
      );
    });

    it("throws when the selected role profile cannot be resolved", async () => {
      const ctx = makeCtx({ isAIMode: false, selectedRoleId: "does-not-exist" });

      await expect(runDownloadPipeline(ctx)).rejects.toThrow("Role profile not found");
      expect(mockGeneratePdfBytes).not.toHaveBeenCalled();
      expect(mockTriggerPdfDownload).not.toHaveBeenCalled();
    });
  });

  describe("AI mode", () => {
    it("uses fetchAIBullets and synthesizes a role profile from the job title", async () => {
      const analytics = makeAnalytics();
      const ctx = makeCtx(
        {
          isAIMode: true,
          jobDescription: "Senior DevRel opening with 10+ years of experience required.",
        },
        analytics,
      );

      const promise = runDownloadPipeline(ctx);
      await finishPipeline(promise);

      expect(mockFetchAIBullets).toHaveBeenCalledOnce();
      expect(mockFetchHeuristicBullets).not.toHaveBeenCalled();

      // Role profile passed to the WASM payload should be AI-synthesized.
      const payload = mockGeneratePdfBytes.mock.calls[0]?.[0];
      expect(payload.roleProfile.id).toBe("ai-curated");
      expect(payload.roleProfile.name).toBe("Head of DevRel");

      expect(analytics.compiled).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_method: "ai",
          download_type: "resume_ai",
          ai_provider: "claude-sonnet",
          ai_response_ms: 1200,
        }),
      );
    });

    it("drives the AI stage state machine: analyzing → selecting → validating → compiling → complete", async () => {
      const setAiStage = vi.fn();
      const ctx = makeCtx({
        isAIMode: true,
        jobDescription: "JD long enough for AI path.",
        setAiStage,
      });

      const promise = runDownloadPipeline(ctx);
      await finishPipeline(promise);

      const stages = setAiStage.mock.calls.map((c) => c[0]);
      expect(stages).toEqual(["analyzing", "selecting", "validating", "compiling", "complete"]);
    });
  });

  describe("error stage tracking", () => {
    it("stamps wasm_load on the ref before calling ensureWasmLoaded", async () => {
      const errorStageRef = { current: "bullet_selection" as const };
      mockEnsureWasmLoaded.mockImplementationOnce(() => {
        expect(errorStageRef.current).toBe("wasm_load");
        throw new Error("wasm boom");
      });

      const ctx = makeCtx({ isAIMode: false, errorStageRef });
      await expect(runDownloadPipeline(ctx)).rejects.toThrow("wasm boom");
      expect(errorStageRef.current).toBe("wasm_load");
    });

    it("stamps pdf_generation on the ref before compiling", async () => {
      const errorStageRef = { current: "bullet_selection" as const };
      mockGeneratePdfBytes.mockImplementationOnce(() => {
        expect(errorStageRef.current).toBe("pdf_generation");
        throw new Error("pdf boom");
      });

      const ctx = makeCtx({ isAIMode: false, errorStageRef });
      await expect(runDownloadPipeline(ctx)).rejects.toThrow("pdf boom");
      expect(errorStageRef.current).toBe("pdf_generation");
    });
  });

  describe("modal close", () => {
    it("schedules closeModal ~2 seconds after completion", async () => {
      const closeModal = vi.fn();
      const ctx = makeCtx({ isAIMode: false, closeModal });

      const promise = runDownloadPipeline(ctx);
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      // Pipeline returned but closeModal shouldn't have fired yet.
      expect(closeModal).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1500);
      expect(closeModal).toHaveBeenCalledOnce();
    });
  });
});
