/**
 * Salary validation helpers for AI output parsing.
 *
 * Extracted from `output-parser.ts` to keep each module focused and under the
 * `max-lines` guardrail.
 *
 * @module lib/ai/output-parser-salary
 */

import type { SalaryInfo } from "./providers/types";

/**
 * ISO 4217 currency codes (common subset) accepted by {@link validateSalary}.
 */
export const ISO_4217_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "CAD",
  "AUD",
  "CHF",
  "HKD",
  "SGD",
  "SEK",
  "NOK",
  "DKK",
  "NZD",
  "MXN",
  "BRL",
  "INR",
  "KRW",
  "PLN",
  "CZK",
  "ILS",
  "THB",
  "PHP",
  "MYR",
  "IDR",
  "ZAR",
  "AED",
  "SAR",
  "TRY",
  "RUB",
]);

/**
 * Validate salary structure with ISO 4217 currency validation.
 *
 * Accepts `null`/`undefined` as "no salary". When present, enforces:
 * - `currency` is a non-empty ISO 4217 code (normalized to uppercase)
 * - `period` is one of annual/monthly/hourly/daily/weekly
 * - `min`/`max` are numeric when present
 *
 * @param salary - Raw salary value from parsed AI JSON.
 * @returns Validation result with either the normalized {@link SalaryInfo} or an error string.
 */
export function validateSalary(
  salary: unknown,
): { valid: true; data: SalaryInfo } | { valid: false; error: string } {
  if (salary === null || salary === undefined) {
    return { valid: true, data: null as unknown as SalaryInfo };
  }

  if (typeof salary !== "object") {
    return { valid: false, error: "salary must be an object or null" };
  }

  const s = salary as Record<string, unknown>;

  // Validate currency is non-empty string
  if (typeof s.currency !== "string" || s.currency.length === 0) {
    return { valid: false, error: "salary.currency must be a non-empty string" };
  }

  // Normalize and validate ISO 4217 currency code
  const currencyUpper = s.currency.toUpperCase();
  if (!ISO_4217_CURRENCIES.has(currencyUpper)) {
    return {
      valid: false,
      error: `salary.currency must be ISO 4217 (USD, GBP, EUR, etc.). Got: ${s.currency}`,
    };
  }

  // Validate period
  const validPeriods = ["annual", "monthly", "hourly", "daily", "weekly"];
  if (!validPeriods.includes(s.period as string)) {
    return {
      valid: false,
      error: `salary.period must be one of: ${validPeriods.join(", ")}`,
    };
  }

  // Validate min/max (optional but must be numbers if present)
  if (s.min !== undefined && typeof s.min !== "number") {
    return { valid: false, error: "salary.min must be a number" };
  }
  if (s.max !== undefined && typeof s.max !== "number") {
    return { valid: false, error: "salary.max must be a number" };
  }

  return {
    valid: true,
    data: {
      min: s.min as number | undefined,
      max: s.max as number | undefined,
      currency: currencyUpper, // Normalized to uppercase
      period: s.period as SalaryInfo["period"],
    },
  };
}
