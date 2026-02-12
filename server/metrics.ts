/**
 * In-memory request metrics for observability.
 * Counters are reset on process restart.
 */

let totalRequests = 0;
let status4xx = 0;
let status5xx = 0;
const latencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 100;

export function recordRequest(statusCode: number, latencyMs: number): void {
  totalRequests++;
  if (statusCode >= 500) status5xx++;
  else if (statusCode >= 400) status4xx++;

  latencySamples.push(latencyMs);
  if (latencySamples.length > MAX_LATENCY_SAMPLES) {
    latencySamples.shift();
  }
}

export function getMetrics(): {
  totalRequests: number;
  status4xx: number;
  status5xx: number;
  latencyMs: { avg: number; p95: number; last: number };
} {
  const last = latencySamples[latencySamples.length - 1] ?? 0;
  const sorted = [...latencySamples].sort((a, b) => a - b);
  const avg =
    sorted.length > 0
      ? sorted.reduce((s, n) => s + n, 0) / sorted.length
      : 0;
  const p95 =
    sorted.length > 0
      ? sorted[Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1)]
      : 0;

  return {
    totalRequests,
    status4xx,
    status5xx,
    latencyMs: { avg: Math.round(avg), p95: Math.round(p95), last },
  };
}
