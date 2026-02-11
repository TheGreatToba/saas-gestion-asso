/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

import type { User } from "./schema";

export interface LoginResponse {
  user: User;
  token: string;
}

export interface ImportFamiliesResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  createdFamilies: { row: number; familyNumber: number; id: string }[];
  updatedFamilies: { row: number; familyNumber: number; id: string }[];
}
