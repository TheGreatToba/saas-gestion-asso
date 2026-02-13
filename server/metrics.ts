/**
 * In-memory request metrics for observability.
 * Counters are reset on process restart.
 */

import type Database from "better-sqlite3";
import { getDb } from "./db";

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

export interface BusinessMetrics {
  totalFamilies: number;
  activeFamilies: number;
  totalNeeds: number;
  urgentNeeds: number;
  totalAids: number;
  aidsToday: number;
  aidsThisWeek: number;
  aidsThisMonth: number;
  totalUsers: number;
  activeUsers: number;
  totalInterventions: number;
  interventionsInProgress: number;
}

export function getBusinessMetrics(organizationId?: string): BusinessMetrics {
  const db = getDb();
  const orgFilter = organizationId ? "WHERE organization_id = ?" : "";
  const params = organizationId ? [organizationId] : [];

  const totalFamilies = (
    db
      .prepare(`SELECT COUNT(*) as c FROM families ${orgFilter}`)
      .get(...params) as { c: number }
  ).c;
  const activeFamilies = (
    db
      .prepare(`SELECT COUNT(*) as c FROM families ${orgFilter} AND archived = 0`)
      .get(...params) as { c: number }
  ).c;
  const totalNeeds = (
    db
      .prepare(`SELECT COUNT(*) as c FROM needs ${orgFilter}`)
      .get(...params) as { c: number }
  ).c;
  const urgentNeeds = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM needs ${orgFilter} AND urgency = 'high' AND status != 'covered'`,
      )
      .get(...params) as { c: number }
  ).c;
  const totalAids = (
    db
      .prepare(`SELECT COUNT(*) as c FROM aids ${orgFilter}`)
      .get(...params) as { c: number }
  ).c;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  monthAgo.setHours(0, 0, 0, 0);

  const aidsToday = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM aids ${orgFilter} AND date >= ?`,
      )
      .get(...params, today.toISOString()) as { c: number }
  ).c;
  const aidsThisWeek = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM aids ${orgFilter} AND date >= ?`,
      )
      .get(...params, weekAgo.toISOString()) as { c: number }
  ).c;
  const aidsThisMonth = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM aids ${orgFilter} AND date >= ?`,
      )
      .get(...params, monthAgo.toISOString()) as { c: number }
  ).c;

  const totalUsers = (
    db
      .prepare(`SELECT COUNT(*) as c FROM users ${orgFilter}`)
      .get(...params) as { c: number }
  ).c;
  const activeUsers = (
    db
      .prepare(`SELECT COUNT(*) as c FROM users ${orgFilter} AND active = 1`)
      .get(...params) as { c: number }
  ).c;

  const totalInterventions = (
    db
      .prepare(`SELECT COUNT(*) as c FROM interventions ${orgFilter}`)
      .get(...params) as { c: number }
  ).c;
  const interventionsInProgress = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM interventions ${orgFilter} AND status = 'in_progress'`,
      )
      .get(...params) as { c: number }
  ).c;

  return {
    totalFamilies,
    activeFamilies,
    totalNeeds,
    urgentNeeds,
    totalAids,
    aidsToday,
    aidsThisWeek,
    aidsThisMonth,
    totalUsers,
    activeUsers,
    totalInterventions,
    interventionsInProgress,
  };
}

export function getMetrics(organizationId?: string): {
  totalRequests: number;
  status4xx: number;
  status5xx: number;
  latencyMs: { avg: number; p95: number; last: number };
  business?: BusinessMetrics;
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

  const result: {
    totalRequests: number;
    status4xx: number;
    status5xx: number;
    latencyMs: { avg: number; p95: number; last: number };
    business?: BusinessMetrics;
  } = {
    totalRequests,
    status4xx,
    status5xx,
    latencyMs: { avg: Math.round(avg), p95: Math.round(p95), last },
  };

  // Ajouter les métriques métier si organizationId est fourni
  if (organizationId) {
    result.business = getBusinessMetrics(organizationId);
  }

  return result;
}
