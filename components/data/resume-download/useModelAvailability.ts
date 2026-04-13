"use client";

/**
 * AI model-availability fetch hook for the resume download flow.
 *
 * Queries `/api/models` once on mount and exposes the resulting availability
 * map. Also performs a one-shot switch of `aiProvider` to the first available
 * model when the current selection becomes unavailable. Extracted from
 * `ResumeDownload.tsx`.
 *
 * @module components/data/resume-download/useModelAvailability
 */

import { useEffect, useState } from "react";

import type { AIProvider, ModelAvailability } from "@/lib/ai/providers/types";

/**
 * Hook that fetches AI-model availability and keeps the selected provider
 * valid.
 *
 * @param aiProvider - Currently selected provider (from the parent component).
 * @param setAiProvider - Setter to swap to an available model when needed.
 * @returns `modelAvailability` map keyed by provider id.
 */
export function useModelAvailability(
  aiProvider: AIProvider,
  setAiProvider: (next: AIProvider) => void,
) {
  const [modelAvailability, setModelAvailability] = useState<Map<AIProvider, ModelAvailability>>(
    new Map(),
  );

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch models");
        return res.json() as Promise<{ models: ModelAvailability[] }>;
      })
      .then(({ models }) => {
        const map = new Map<AIProvider, ModelAvailability>();
        for (const m of models) map.set(m.id, m);
        setModelAvailability(map);
      })
      .catch(() => {
        // Silently fail — dropdown falls back to static list
      });
  }, []);

  // If current selection is unavailable, switch to first available
  useEffect(() => {
    const current = modelAvailability.get(aiProvider);
    if (current && !current.available) {
      const firstAvailable = [...modelAvailability.values()].find((m) => m.available);
      if (firstAvailable) setAiProvider(firstAvailable.id);
    }
  }, [modelAvailability, aiProvider, setAiProvider]);

  return modelAvailability;
}
