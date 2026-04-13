/**
 * Formatting helpers for AI prompt construction.
 *
 * Turns compendium entries into markdown-style text blocks that the model can
 * parse reliably. Extracted from the original `prompt.ts` to keep each module
 * under the `max-lines` guardrail.
 *
 * @module lib/ai/prompts/formatting
 */

import type { ResumeData } from "@/lib/types/generated-resume";

/**
 * Format all bullets from the compendium with company + position hierarchy.
 *
 * Output format:
 * ```
 * ### Company Name (2020–2023)
 * Location: San Francisco, CA
 *
 * #### Position Title (2021–2023)
 *
 * - [bullet-id] Description of achievement
 *   tags: typescript, leadership | priority: 8/10
 * ```
 *
 * @param compendium - Full resume data.
 * @returns Newline-delimited markdown string for prompt injection.
 */
export function formatBulletsForPrompt(compendium: ResumeData): string {
  const lines: string[] = [];

  for (const company of compendium.experience) {
    const companyName = company.name || company.id;
    const dateRange = formatDateRange(company.dateStart, company.dateEnd);
    lines.push(`### ${companyName} (${dateRange})`);
    if (company.location) {
      lines.push(`Location: ${company.location}`);
    }
    lines.push("");

    for (const position of company.children) {
      const posDateRange = formatDateRange(position.dateStart, position.dateEnd);
      lines.push(`#### ${position.name} (${posDateRange})`);
      lines.push("");

      for (const bullet of position.children) {
        lines.push(formatBullet(bullet));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format a single bullet as a 2-line markdown entry for prompt injection.
 *
 * Output:
 * ```
 * - [bullet-id] Description of the achievement
 *   tags: typescript, api | priority: 8/10
 * ```
 *
 * @param bullet - Bullet with id, description, tags, and priority.
 */
export function formatBullet(bullet: {
  id: string;
  description: string;
  tags: string[];
  priority: number;
  name?: string | null;
}): string {
  const idLine = `- [${bullet.id}]`;
  const desc = bullet.description;
  const meta = `  tags: ${bullet.tags.join(", ")} | priority: ${bullet.priority}/10`;

  return `${idLine} ${desc}\n${meta}`;
}

/**
 * Format a date range for display in the prompt.
 *
 * @param start - ISO-like date string (`YYYY` or `YYYY-MM`).
 * @param end - Optional end date; `null`/`undefined` renders as "Present".
 * @returns `"2020–Present"` style string.
 *
 * @example
 * formatDateRange("2020", "2023")    // "2020–2023"
 * formatDateRange("2022-06", null)   // "2022–Present"
 */
export function formatDateRange(start: string, end?: string | null): string {
  const startYear = start.split("-")[0];
  const endYear = end ? end.split("-")[0] : "Present";
  return `${startYear}–${endYear}`;
}
