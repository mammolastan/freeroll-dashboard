// lib/error-logger.ts

import { prisma } from "@/lib/prisma";

export type ErrorSeverity = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogErrorParams {
  error_code: string;
  feature: string;
  severity?: ErrorSeverity;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
  player_uid?: string | null;
  league_id?: number | null;
  url?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
}

/**
 * Server-side error logger. Call from API routes and server components.
 * Never throws — logging failure must not break the user-facing request.
 */
export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const stack =
      params.error instanceof Error ? params.error.stack ?? null : null;

    const level = params.severity ?? "error";
    const consoleMsg = `[${level.toUpperCase()}] [${params.feature}] ${params.error_code}: ${params.message}`;
    if (level === "fatal" || level === "error")
      console.error(consoleMsg, params.error ?? "");
    else if (level === "warn") console.warn(consoleMsg);
    else console.log(consoleMsg);

    await prisma.appErrorLog.create({
      data: {
        error_code: params.error_code,
        feature: params.feature,
        severity: level,
        message: params.message,
        stack: stack,
        context: params.context ? JSON.stringify(params.context) : null,
        player_uid: params.player_uid ?? null,
        league_id: params.league_id ?? null,
        url: params.url ?? null,
        user_agent: params.user_agent ?? null,
        ip_address: params.ip_address ?? null,
      },
    });
  } catch (loggingError) {
    console.error("[error-logger] Failed to write to DB:", loggingError);
  }
}

/**
 * Convenience: log an error and return a standardized API error response.
 * Use in API routes to log + respond in one call.
 */
export async function logAndRespond(
  params: LogErrorParams,
  httpStatus: number = 500,
  userMessage: string = "An unexpected error occurred."
): Promise<Response> {
  await logError(params);
  return Response.json({ error: userMessage }, { status: httpStatus });
}
