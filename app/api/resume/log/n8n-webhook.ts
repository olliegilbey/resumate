/**
 * n8n webhook helper for `/api/resume/log`.
 *
 * Wraps the HTTP call to the configured n8n webhook so the route handler can
 * trigger notifications without inlining the fetch + auth plumbing.
 *
 * @module app/api/resume/log/n8n-webhook
 */

/**
 * Trigger the configured n8n webhook with a JSON payload.
 *
 * Silently skips when `N8N_WEBHOOK_URL` or `N8N_WEBHOOK_SECRET` is missing
 * (dev/local). Rethrows on non-2xx so callers can attach error logging.
 *
 * @param payload - Arbitrary JSON body; include an `event` key for n8n routing.
 * @returns Promise that resolves after the webhook returns 2xx, or immediately
 *   when the webhook isn't configured. Rejects (rethrows the underlying error)
 *   on non-2xx responses and network failures.
 * @example
 * ```ts
 * await triggerN8nWebhook({ event: "resume_download_notified", email: hash });
 * ```
 */
export async function triggerN8nWebhook(payload: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookAuth = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookAuth) {
    console.warn("[n8n] Webhook not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhookAuth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    console.warn(`[n8n] Webhook triggered successfully: ${payload.event}`);
  } catch (error) {
    console.error("[n8n] Webhook error:", error);
    throw error;
  }
}
