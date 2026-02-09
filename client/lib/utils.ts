import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NeedStatus, NeedUrgency, PriorityLevel } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============ STATUS BADGE STYLING ============

/**
 * Returns Tailwind classes for need status badges.
 * Couvert = green, Partiellement couvert = orange, En attente = red
 */
export function statusBadgeClasses(status: NeedStatus): string {
  switch (status) {
    case "covered":
      return "bg-green-100 text-green-800 border-green-300";
    case "partial":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "pending":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "";
  }
}

/**
 * Returns Tailwind classes for urgency badges.
 */
export function urgencyBadgeClasses(urgency: NeedUrgency): string {
  switch (urgency) {
    case "high":
      return "bg-red-100 text-red-800 border-red-300";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "low":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "";
  }
}

/**
 * Returns Tailwind classes for computed priority level badges.
 */
export function priorityBadgeClasses(level: PriorityLevel): string {
  switch (level) {
    case "critical":
      return "bg-red-600 text-white border-red-700";
    case "high":
      return "bg-red-100 text-red-800 border-red-300";
    case "medium":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "low":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "none":
      return "bg-gray-100 text-gray-600 border-gray-300";
    default:
      return "";
  }
}

/**
 * Returns left border color class for a need card based on priority level.
 */
export function priorityBorderClass(level: PriorityLevel): string {
  switch (level) {
    case "critical":
      return "border-l-4 border-l-red-600";
    case "high":
      return "border-l-4 border-l-red-400";
    case "medium":
      return "border-l-4 border-l-yellow-500";
    case "low":
      return "border-l-4 border-l-blue-400";
    case "none":
      return "border-gray-200";
    default:
      return "border-gray-200";
  }
}
