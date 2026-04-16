/**
 * Regression tests for the `TurnstileModal` error-state gate.
 *
 * Why this test exists
 * --------------------
 * The resume download pipeline relies on TWO independent guards to prevent
 * an auto-retry loop on persistent server failures (e.g. an unavailable AI
 * model) from burning through the 5-req/hour `/api/resume/ai-select` rate
 * limit:
 *
 *   1. `useDownloadExecution` bails when `status === "error"`.
 *   2. `TurnstileModal` hides the Turnstile widget when `status === "error"`.
 *
 * Guard (2) is load-bearing because `@marsidev/react-turnstile` auto-runs
 * the challenge on mount and calls `onSuccess` with a fresh token, which
 * would flip status back to "idle" and bypass guard (1). If the widget is
 * ever rendered in the error state, the loop returns silently.
 *
 * These tests pin the modal's render contract so a future refactor cannot
 * reintroduce the bug without a CI failure.
 *
 * @module components/data/resume-download/__tests__/TurnstileModal.test
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";

import { TurnstileModal } from "../TurnstileModal";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

// Mock the Turnstile widget so it renders a probe element we can assert on
// without pulling in Cloudflare's real challenge script.
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile-widget">turnstile</div>,
}));

// Stable RefObject required by the component's TS signature. React 19 still
// accepts legacy `{ current: null }` refs here.
const makeTurnstileRef = () => createRef<TurnstileInstance | null>();

const baseProps = {
  siteKey: "test-site-key",
  theme: "light" as const,
  aiProvider: "cerebras-gpt" as const,
  aiStage: "idle" as const,
  aiRetryCount: 0,
  isJobDescriptionMode: false,
  statusMessage: "Download PDF",
  turnstileKey: 0,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  onExpire: vi.fn(),
  onRetry: vi.fn(),
};

describe("TurnstileModal error-state gate", () => {
  it("renders the Turnstile widget when idle and unverified", () => {
    render(
      <TurnstileModal
        {...baseProps}
        status="idle"
        errorMessage={null}
        verifiedToken={null}
        turnstileRef={makeTurnstileRef()}
      />,
    );
    expect(screen.getByTestId("turnstile-widget")).toBeTruthy();
  });

  it("does NOT render the Turnstile widget when status is 'error'", () => {
    // Regression guard: if this assertion fails, the retry loop is back.
    // A fresh widget mount auto-executes the challenge and calls onSuccess,
    // which `handleTurnstileSuccess` would use to flip status back to idle
    // and re-enter the pipeline — burning through the rate limit.
    render(
      <TurnstileModal
        {...baseProps}
        status="error"
        errorMessage="AI model unavailable"
        verifiedToken={null}
        turnstileRef={makeTurnstileRef()}
      />,
    );
    expect(screen.queryByTestId("turnstile-widget")).toBeNull();
    // Error panel + Try again button should be visible instead.
    expect(screen.getByText("AI model unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("does NOT render the Turnstile widget while compiling", () => {
    render(
      <TurnstileModal
        {...baseProps}
        status="generating"
        errorMessage={null}
        verifiedToken="tok"
        turnstileRef={makeTurnstileRef()}
      />,
    );
    expect(screen.queryByTestId("turnstile-widget")).toBeNull();
  });

  it("hides the 'Verify You're Human' heading in the error state", () => {
    render(
      <TurnstileModal
        {...baseProps}
        status="error"
        errorMessage="Something went wrong"
        verifiedToken={null}
        turnstileRef={makeTurnstileRef()}
      />,
    );
    expect(screen.queryByText(/verify you.?re human/i)).toBeNull();
  });
});
