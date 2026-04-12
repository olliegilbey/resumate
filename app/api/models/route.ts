/**
 * GET /api/models
 *
 * Returns available AI models by querying provider APIs.
 * Proxies requests so API keys stay server-side.
 * Response is cached for 5 minutes to avoid hammering upstream.
 *
 * Rate limit: 30 requests per minute per IP. X-RateLimit-* headers are
 * included on both successful and 429 responses.
 */

import { NextRequest, NextResponse } from "next/server";
import { AI_MODELS, type AIProvider, type ModelAvailability } from "@/lib/ai/providers/types";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

const CEREBRAS_MODELS_URL = "https://api.cerebras.ai/v1/models";

/**
 * In-memory cache: stores result + timestamp.
 * NOTE: In serverless (Vercel), each function instance has its own cache.
 * Cold starts trigger fresh fetches. This is acceptable for non-critical
 * availability data — staleness window is at most 5 minutes per instance.
 */
let cache: { data: ModelAvailability[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CerebrasModelEntry {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface CerebrasModelsResponse {
  object: string;
  data: CerebrasModelEntry[];
}

const RATE_LIMIT = { limit: 30, window: 60 * 1000 } as const;

/**
 * Handle GET /api/models.
 *
 * @param request - Incoming Next.js request; used to derive the client IP for
 *   per-IP rate limiting. Optional to remain backward-compatible with call sites
 *   (such as tests) that previously invoked this handler with no arguments.
 */
export async function GET(
  request?: NextRequest,
): Promise<
  NextResponse<
    { models: ModelAvailability[] } | { error: string; message: string; resetAt: number }
  >
> {
  // Rate limit check first (before cache lookup or upstream fetch)
  const clientIP = request ? getClientIP(request) : "unknown";
  const rateLimit = checkRateLimit(`models:${clientIP}`, RATE_LIMIT);

  const rateLimitHeaders = new Headers();
  rateLimitHeaders.set("X-RateLimit-Limit", rateLimit.limit.toString());
  rateLimitHeaders.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
  rateLimitHeaders.set("X-RateLimit-Reset", new Date(rateLimit.reset).toISOString());

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Maximum ${RATE_LIMIT.limit} requests per minute. Please try again later.`,
        resetAt: rateLimit.reset,
      },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  // Return cached response if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.data }, { headers: rateLimitHeaders });
  }

  // Fetch available Cerebras models
  let cerebrasModelIds: string[] = [];
  let cerebrasFetchFailed = false;

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(CEREBRAS_MODELS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = (await response.json()) as CerebrasModelsResponse;
        cerebrasModelIds = data.data.map((m) => m.id);
      } else {
        cerebrasFetchFailed = true;
      }
    } catch {
      cerebrasFetchFailed = true;
    }
  }

  // Build availability for each configured model
  const models: ModelAvailability[] = (
    Object.entries(AI_MODELS) as [AIProvider, (typeof AI_MODELS)[AIProvider]][]
  ).map(([id, config]) => {
    if (config.provider === "cerebras") {
      if (!apiKey) {
        return {
          id,
          label: config.label,
          cost: config.cost,
          available: false,
          reason: "API key not configured",
        };
      }
      if (cerebrasFetchFailed) {
        // Can't confirm — assume available so user can try
        return { id, label: config.label, cost: config.cost, available: true };
      }
      const available = cerebrasModelIds.includes(config.model);
      return {
        id,
        label: config.label,
        cost: config.cost,
        available,
        ...(!available && { reason: "Model not available on provider" }),
      };
    }

    // Anthropic: available if API key is configured
    if (config.provider === "anthropic") {
      const hasKey = !!process.env.ANTHROPIC_API_KEY;
      return {
        id,
        label: config.label,
        cost: config.cost,
        available: hasKey,
        ...(!hasKey && { reason: "Coming soon" }),
      };
    }

    return {
      id,
      label: config.label,
      cost: config.cost,
      available: false,
      reason: "Unknown provider",
    };
  });

  // Cache the result
  cache = { data: models, timestamp: Date.now() };

  return NextResponse.json({ models }, { headers: rateLimitHeaders });
}
