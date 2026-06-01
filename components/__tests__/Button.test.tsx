import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "../ui/Button";

describe("Button", () => {
  it("renders a native button by default with type='button'", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders as an anchor when as='a', without a stray type attribute", () => {
    render(
      <Button as="a" href="https://example.com" target="_blank" rel="noopener noreferrer">
        Visit
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Visit" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    // `type` is button-only and must not leak onto the anchor.
    expect(link).not.toHaveAttribute("type");
  });

  it("applies the aqua variant foreground class", () => {
    render(<Button variant="aqua">Aqua</Button>);
    // Aqua foreground token (light value) — confirms the variant maps to the aqua tint.
    expect(screen.getByRole("button", { name: "Aqua" }).className).toContain("0.30_0.06_175");
  });
});
