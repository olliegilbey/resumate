import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getProvider,
  getFirstAvailableProvider,
  getAvailableProviders,
  selectBulletsWithAI,
} from "../../providers";
import { AnthropicProvider } from "../../providers/anthropic";
import { CerebrasProvider } from "../../providers/cerebras";
import { AISelectionError } from "../../errors";
import type { ResumeData } from "@/lib/types/generated-resume";
import type { SelectionResult } from "../../providers/types";

// Mock providers
vi.mock("../../providers/anthropic", () => ({
  AnthropicProvider: vi.fn(),
  createAnthropicProvider: vi.fn(),
}));

vi.mock("../../providers/cerebras", () => ({
  CerebrasProvider: vi.fn(),
  createCerebrasProvider: vi.fn(),
}));

const mockCompendium: ResumeData = {
  personal: { name: "Test" },
  experience: [
    {
      id: "company-a",
      name: "Corp",
      dateStart: "2020-01",
      priority: 5,
      tags: [],
      children: [
        {
          id: "pos-1",
          name: "Eng",
          dateStart: "2020-01",
          priority: 5,
          tags: [],
          children: [
            { id: "bullet-1", description: "A", priority: 5, tags: [] },
            { id: "bullet-2", description: "B", priority: 5, tags: [] },
          ],
        },
      ],
    },
  ],
};

describe("getProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AnthropicProvider for claude-sonnet", () => {
    getProvider("claude-sonnet");
    expect(AnthropicProvider).toHaveBeenCalledWith("claude-sonnet");
  });

  it("returns AnthropicProvider for claude-haiku", () => {
    getProvider("claude-haiku");
    expect(AnthropicProvider).toHaveBeenCalledWith("claude-haiku");
  });

  it("returns CerebrasProvider for cerebras-gpt", () => {
    getProvider("cerebras-gpt");
    expect(CerebrasProvider).toHaveBeenCalledWith("cerebras-gpt");
  });

  it("returns CerebrasProvider for cerebras-llama", () => {
    getProvider("cerebras-llama");
    expect(CerebrasProvider).toHaveBeenCalledWith("cerebras-llama");
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("unknown" as "cerebras-gpt")).toThrow("Unknown provider");
  });
});

describe("getFirstAvailableProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns first available provider in fallback order", () => {
    // cerebras-gpt is first in FALLBACK_ORDER
    const mockIsAvailable = vi.fn().mockReturnValue(true);
    (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }));

    const result = getFirstAvailableProvider();
    expect(result).toBe("cerebras-gpt");
  });

  it("returns null if no providers available", () => {
    const mockIsAvailable = vi.fn().mockReturnValue(false);
    (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }));
    (AnthropicProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      isAvailable: mockIsAvailable,
    }));

    const result = getFirstAvailableProvider();
    expect(result).toBeNull();
  });
});

describe("selectBulletsWithAI", () => {
  const validResult: SelectionResult = {
    bullets: [
      { id: "bullet-1", score: 0.95 },
      { id: "bullet-2", score: 0.88 },
    ],
    reasoning: "Test",
    jobTitle: null,
    salary: null,
    provider: "cerebras-gpt",
    promptUsed: "test prompt",
    attemptCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful selection", () => {
    it("returns result on first attempt", async () => {
      const mockSelect = vi.fn().mockResolvedValue(validResult);
      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: "cerebras-gpt",
      }));

      const result = await selectBulletsWithAI(
        { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
        "cerebras-gpt",
      );

      expect(result).toEqual(validResult);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("retry logic", () => {
    it("retries on output format error with context", async () => {
      const formatError = new AISelectionError(
        "Wrong count",
        [{ code: "E004_WRONG_BULLET_COUNT", message: "Expected 2", help: "Fix count" }],
        "cerebras-gpt",
      );

      const mockSelect = vi
        .fn()
        .mockRejectedValueOnce(formatError)
        .mockResolvedValueOnce(validResult);

      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: "cerebras-gpt",
      }));

      const result = await selectBulletsWithAI(
        { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
        "cerebras-gpt",
      );

      expect(result).toEqual({ ...validResult, attemptCount: 2 });
      expect(mockSelect).toHaveBeenCalledTimes(2);

      // Second call should include retry context
      const secondCall = mockSelect.mock.calls[1][0];
      expect(secondCall.retryContext).toContain("E004_WRONG_BULLET_COUNT");
    });

    it("throws after maxRetries exhausted", async () => {
      const formatError = new AISelectionError(
        "Wrong count",
        [{ code: "E004_WRONG_BULLET_COUNT", message: "Expected 2", help: "Fix" }],
        "cerebras-gpt",
      );

      const mockSelect = vi.fn().mockRejectedValue(formatError);

      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: "cerebras-gpt",
      }));

      await expect(
        selectBulletsWithAI(
          { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
          "cerebras-gpt",
          { maxRetries: 2 },
        ),
      ).rejects.toThrow(AISelectionError);

      expect(mockSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe("provider down — fail fast", () => {
    it("throws immediately on provider DOWN without retrying", async () => {
      const downError = new AISelectionError(
        "Rate limited",
        [{ code: "E011_PROVIDER_DOWN", message: "Down", help: "Wait" }],
        "cerebras-gpt",
      );

      const mockSelect = vi.fn().mockRejectedValue(downError);

      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: "cerebras-gpt",
      }));

      await expect(
        selectBulletsWithAI(
          { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
          "cerebras-gpt",
        ),
      ).rejects.toThrow("unavailable");

      // Should NOT retry — fail fast on provider down
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("throws when provider is not configured", async () => {
      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => false,
        name: "cerebras-gpt",
      }));

      await expect(
        selectBulletsWithAI(
          { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
          "cerebras-gpt",
        ),
      ).rejects.toThrow("not configured");
    });
  });

  describe("error aggregation", () => {
    it("aggregates errors from multiple attempts", async () => {
      const error1 = new AISelectionError(
        "Error 1",
        [{ code: "E004_WRONG_BULLET_COUNT", message: "Count", help: "" }],
        "cerebras-gpt",
      );
      const error2 = new AISelectionError(
        "Error 2",
        [{ code: "E005_INVALID_BULLET_ID", message: "ID", help: "" }],
        "cerebras-gpt",
      );

      const mockSelect = vi.fn().mockRejectedValueOnce(error1).mockRejectedValueOnce(error2);

      (CerebrasProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        isAvailable: () => true,
        select: mockSelect,
        name: "cerebras-gpt",
      }));

      try {
        await selectBulletsWithAI(
          { jobDescription: "Test", compendium: mockCompendium, maxBullets: 2 },
          "cerebras-gpt",
          { maxRetries: 2 },
        );
        expect.fail("Should have thrown");
      } catch (e) {
        const err = e as AISelectionError;
        expect(err.errors).toHaveLength(2);
        expect(err.errors[0].code).toBe("E004_WRONG_BULLET_COUNT");
        expect(err.errors[1].code).toBe("E005_INVALID_BULLET_ID");
      }
    });
  });
});
