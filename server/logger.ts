type LogLevel = "info" | "error" | "warn";

export interface LogMeta {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  route?: string;
  statusCode?: number;
  latencyMs?: number;
  errorName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack?: any;
}

function baseLog(level: LogLevel, message: string, meta: LogMeta = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  if (level === "error") {
    // Structured error logs
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(payload));
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(payload));
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  }
}

export function logInfo(message: string, meta?: LogMeta) {
  baseLog("info", message, meta);
}

export function logWarn(message: string, meta?: LogMeta) {
  baseLog("warn", message, meta);
}

export function logError(message: string, meta?: LogMeta) {
  baseLog("error", message, meta);
}

export function generateRequestId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 10)
  );
}

/**
 * Hook for alerting on high 5xx rate or DB-related errors.
 * Currently a no-op that just logs a warning, but can be wired
 * to e.g. Sentry, email, Slack, etc.
 */
export function notifyOnSevereError(message: string, meta?: LogMeta) {
  logWarn("[ALERT] Severe error detected", {
    ...meta,
    details: { alertMessage: message },
  });
}

