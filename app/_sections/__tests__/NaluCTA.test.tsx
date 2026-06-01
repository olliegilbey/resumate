import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { NaluCTA } from "../NaluCTA";

describe("NaluCTA", () => {
  it("links to the Nalu app in a new tab with safe rel", () => {
    render(<NaluCTA />);
    const link = screen.getByRole("link", { name: /try nalu/i });
    expect(link).toHaveAttribute("href", "https://nalu.ollie.gg");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the button label and the pitch copy", () => {
    render(<NaluCTA />);
    expect(screen.getByText("Try Nalu")).toBeInTheDocument();
    expect(screen.getByText("Duolingo for Anything.")).toBeInTheDocument();
    expect(
      screen.getByText(/turning any topic into a gamified, AI-built course/i),
    ).toBeInTheDocument();
  });
});
