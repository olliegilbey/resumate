/**
 * POST /api/resume/ai-select
 *
 * AI-powered bullet selection from job description.
 * Uses LLM to score bullets, then applies diversity constraints server-side.
 *
 * Rate limit: 5 requests per hour per IP (stricter due to AI costs)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { FALLBACK_ORDER } from "@/lib/ai/providers";
import { formatPromptForAnalytics } from "@/lib/ai/prompts/analytics";
import type { AIProvider } from "@/lib/ai/providers/types";
import { AISelectionError } from "@/lib/ai/errors";
import { captureEvent, flushEvents } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { DEFAULT_SELECTION_CONFIG } from "@/lib/selection";
import { loadResumeData, runAISelectionPipeline } from "./flow";

/**
 * Extend the Vercel serverless function timeout so the AI call has room to
 * finish. Cerebras free-tier queue times for popular models (e.g. Qwen 235B)
 * can spike past 30s during heavy traffic; the default Hobby-plan limit of
 * 10s would truncate the request, causing Cloudflare to surface a 520.
 *
 * 60s is the Vercel Hobby plan ceiling. The inner provider call still has its
 * own 30s `AbortSignal.timeout`, so this is a safety margin, not a target.
 *
 * @see https://vercel.com/docs/functions/runtimes#max-duration
 */
export const maxDuration = 60;

// WARNING: In-memory token replay prevention is lost on serverless cold starts.
// For production at scale, consider storing used tokens in Redis/KV with TTL
// matching Turnstile token validity (~5 min). Current implementation provides
// protection within a single function instance only.
const usedTokens = new Set<string>();

// Rate limit config: 5 requests per hour (stricter for AI)
const AI_RATE_LIMIT = {
  limit: 5,
  window: 60 * 60 * 1000, // 1 hour
};

// Minimum job description length
const MIN_JOB_DESCRIPTION_LENGTH = 50;

export async function POST(request: NextRequest) {
  const headers = new Headers();
  const clientIP = getClientIP(request);

  try {
    // Parse request body
    const body = (await request.json()) as {
      jobDescription?: string;
      turnstileToken?: string;
      provider?: string;
      config?: {
        maxBullets?: number;
        maxPerCompany?: number;
        maxPerPosition?: number;
        minPerCompany?: number;
      };
      email?: string;
      linkedin?: string;
      sessionId?: string;
    };
    const {
      jobDescription,
      turnstileToken,
      provider = FALLBACK_ORDER[0], // Default to first in fallback order
      config,
      email,
      linkedin,
      sessionId,
    } = body;

    // Validate required fields
    if (!jobDescription || !turnstileToken) {
      return NextResponse.json(
        { error: "Missing required fields: jobDescription, turnstileToken" },
        { status: 400 },
      );
    }

    // Validate job description length
    if (jobDescription.length < MIN_JOB_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: `Job description too short (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters)`,
          received: jobDescription.length,
        },
        { status: 400 },
      );
    }

    // Validate provider
    const validProviders: AIProvider[] = [
      "cerebras-gpt",
      "cerebras-llama",
      "claude-sonnet",
      "claude-haiku",
    ];
    if (!provider || !validProviders.includes(provider as AIProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 },
      );
    }

    // Rate limit check
    const rateLimit = checkRateLimit(clientIP, AI_RATE_LIMIT);

    headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
    headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
    headers.set("X-RateLimit-Reset", new Date(rateLimit.reset).toISOString());

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Maximum 5 AI requests per hour. Please try again later.",
          resetAt: rateLimit.reset,
        },
        { status: 429, headers },
      );
    }

    // Token replay check (mark used immediately to prevent TOCTOU race)
    if (usedTokens.has(turnstileToken)) {
      console.warn("[AI Select] Duplicate Turnstile token blocked");
      return NextResponse.json({ error: "Token already used" }, { status: 403 });
    }
    usedTokens.add(turnstileToken);

    // Turnstile verification
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      console.error("[AI Select] TURNSTILE_SECRET_KEY not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      },
    );

    const turnstileData = (await turnstileResponse.json()) as { success?: boolean };
    if (!turnstileData.success) {
      return NextResponse.json({ error: "Turnstile verification failed" }, { status: 403 });
    }

    // Load resume data
    const resumeData = await loadResumeData();
    if (!resumeData) {
      return NextResponse.json({ error: "Resume data not available" }, { status: 500 });
    }

    // Selection config with defaults (matches Rust SelectionConfig)
    const selectionConfig = {
      maxBullets: config?.maxBullets ?? DEFAULT_SELECTION_CONFIG.maxBullets,
      maxPerCompany: config?.maxPerCompany ?? DEFAULT_SELECTION_CONFIG.maxPerCompany,
      maxPerPosition: config?.maxPerPosition ?? DEFAULT_SELECTION_CONFIG.maxPerPosition,
      minPerCompany: config?.minPerCompany ?? DEFAULT_SELECTION_CONFIG.minPerCompany,
    };

    // Call AI provider, apply diversity constraints, and reorder by chronology
    const { selected, aiResult, aiDuration } = await runAISelectionPipeline({
      jobDescription,
      resumeData,
      provider: provider as AIProvider,
      selectionConfig,
    });

    // Build analytics data (snake_case per spec)
    const bullets_by_company: Record<string, number> = {};
    const bullets_by_tag: Record<string, number> = {};
    const bullet_ids: string[] = [];

    for (const item of selected) {
      bullet_ids.push(item.bullet.id);
      bullets_by_company[item.companyId] = (bullets_by_company[item.companyId] || 0) + 1;
      for (const tag of item.bullet.tags || []) {
        bullets_by_tag[tag] = (bullets_by_tag[tag] || 0) + 1;
      }
    }

    // Format prompt for analytics (replaces system prompt + JD with placeholders)
    const aiPromptForAnalytics = await formatPromptForAnalytics(
      aiResult.promptUsed,
      jobDescription,
    );

    // Track resume_prepared event (unified for AI and heuristic)
    // NOTE: PII (email, linkedin, client_ip, job_description) is intentionally captured.
    // This powers n8n automation to notify the resume owner when recruiters show interest.
    // Privacy policy covers this data collection. Do not remove without owner approval.
    await captureEvent(
      sessionId || clientIP,
      ANALYTICS_EVENTS.RESUME_PREPARED,
      {
        session_id: sessionId,
        email,
        linkedin,
        generation_method: "ai",
        download_type: "resume_ai",
        ai_provider: aiResult.provider,
        job_description: jobDescription, // Full JD for n8n automation
        job_description_length: jobDescription.length,
        job_title: aiResult.jobTitle,
        extracted_salary_min: aiResult.salary?.min,
        extracted_salary_max: aiResult.salary?.max,
        salary_currency: aiResult.salary?.currency,
        salary_period: aiResult.salary?.period,
        bullet_ids,
        bullet_count: selected.length,
        bullets_by_company,
        bullets_by_tag,
        config: {
          max_bullets: selectionConfig.maxBullets,
          max_per_company: selectionConfig.maxPerCompany,
          max_per_position: selectionConfig.maxPerPosition,
        },
        ai_response_ms: aiDuration,
        tokens_used: aiResult.tokensUsed,
        reasoning: aiResult.reasoning,
        ai_prompt: aiPromptForAnalytics, // Full prompt with system hash placeholder
        ai_attempt_count: aiResult.attemptCount, // 1 = success first try, >1 = retries
        client_ip: clientIP,
      },
      clientIP,
    );

    await flushEvents();

    return NextResponse.json(
      {
        success: true,
        selected,
        count: selected.length,
        reasoning: aiResult.reasoning,
        jobTitle: aiResult.jobTitle,
        salary: aiResult.salary,
        metadata: {
          provider: aiResult.provider,
          tokensUsed: aiResult.tokensUsed,
          duration: aiDuration,
        },
        config: selectionConfig,
        timestamp: Date.now(),
      },
      { headers },
    );
  } catch (error) {
    console.error("[AI Select] Error:", error);

    // Handle AI-specific errors with user-friendly message
    if (error instanceof AISelectionError) {
      return NextResponse.json(
        {
          error: "AI selection failed",
          userMessage: error.getSimplifiedMessage(),
          provider: error.provider,
          retriesAttempted: error.retriesAttempted,
        },
        { status: 500, headers },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
