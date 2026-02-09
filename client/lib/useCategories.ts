import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Category } from "@shared/schema";

/**
 * Shared hook for dynamic aid/need categories.
 * Returns categories list and a label lookup map.
 * Cached globally by React Query.
 */
export function useCategories() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
    staleTime: 1000 * 60 * 5, // 5 min cache — categories change rarely
  });

  // Build a fast lookup: categoryId -> displayName
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat.name;
  }

  /** Get display name for a category id, fallback to the raw id */
  const getCategoryLabel = (id: string): string => categoryMap[id] || id;

  return { categories, categoryMap, getCategoryLabel, isLoading };
}
