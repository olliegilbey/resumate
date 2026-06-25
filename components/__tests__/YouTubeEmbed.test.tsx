import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { YouTubeEmbed } from "../ui/YouTubeEmbed";

describe("YouTubeEmbed", () => {
  it("renders a privacy-domain iframe for the given videoId", () => {
    render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    const frame = screen.getByTitle("My talk");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc123");
  });

  it("lazy-loads and allows fullscreen", () => {
    render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    const frame = screen.getByTitle("My talk");
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("allowfullscreen");
  });

  it("sandboxes the third-party player while preserving playback features", () => {
    render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    const sandbox = screen.getByTitle("My talk").getAttribute("sandbox") ?? "";
    // Restrictive by default: no top-navigation, no plugins.
    expect(sandbox).not.toBe("");
    // Tokens the YouTube player needs to function and stay interactive.
    for (const token of [
      "allow-scripts",
      "allow-same-origin",
      "allow-presentation",
      "allow-popups",
      "allow-popups-to-escape-sandbox",
    ]) {
      expect(sandbox.split(/\s+/)).toContain(token);
    }
  });

  it("wraps the iframe in a 16:9 aspect box and centered max-width wrapper", () => {
    const { container } = render(<YouTubeEmbed videoId="abc123" title="My talk" />);
    // Outer wrapper centers + caps width.
    expect(container.firstChild).toHaveClass("mx-auto", "max-w-4xl");
    // Aspect box enforces 16:9.
    const aspectBox = container.querySelector(".aspect-video");
    expect(aspectBox).not.toBeNull();
  });

  it("merges a caller-supplied className onto the wrapper", () => {
    const { container } = render(
      <YouTubeEmbed videoId="abc123" title="My talk" className="mt-10" />,
    );
    expect(container.firstChild).toHaveClass("mt-10");
  });
});
