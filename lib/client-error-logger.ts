// lib/client-error-logger.ts

export type ClientErrorSeverity = "warn" | "error" | "fatal";

export interface ClientLogErrorParams {
  error_code: string;
  feature: string;
  severity?: ClientErrorSeverity;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
  url?: string;
}

/**
 * Client-side error logger. Posts to /api/log-error. Fire-and-forget — never throws.
 * Safe to call anywhere in client components, event handlers, etc.
 */
export function logClientError(params: ClientLogErrorParams): void {
  const payload = {
    ...params,
    stack: params.error instanceof Error ? params.error.stack : undefined,
    url:
      params.url ??
      (typeof window !== "undefined" ? window.location.href : undefined),
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  fetch("/api/log-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    console.warn("[client-error-logger] Failed to send error log");
  });
}
