import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Category, Article } from "@shared/schema";

/**
 * Shared hook for dynamic aid/need categories and articles.
 * Returns categories list, articles list, and lookup helpers.
 * Cached globally by React Query.
 */
export function useCategories() {
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: api.getAllArticles,
    staleTime: 1000 * 60 * 5,
  });

  // Build fast lookups
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat.name;
  }

  const articleMap: Record<string, Article> = {};
  for (const art of articles) {
    articleMap[art.id] = art;
  }

  /** Get display name for a category id */
  const getCategoryLabel = (id: string): string => categoryMap[id] || id;

  /** Get articles for a specific category */
  const getArticlesForCategory = (categoryId: string): Article[] =>
    articles.filter((a) => a.categoryId === categoryId);

  /** Get article name with category prefix: "Farine > Pack 1kg" */
  const getArticleLabel = (articleId: string): string => {
    const art = articleMap[articleId];
    if (!art) return articleId;
    const catName = categoryMap[art.categoryId] || art.categoryId;
    return `${catName} › ${art.name}`;
  };

  /** Total stock across all articles for a category */
  const getCategoryTotalStock = (categoryId: string): number =>
    articles
      .filter((a) => a.categoryId === categoryId)
      .reduce((sum, a) => sum + a.stockQuantity, 0);

  /** Low stock articles */
  const lowStockArticles = articles.filter(
    (a) => a.stockMin > 0 && a.stockQuantity <= a.stockMin
  );

  const isLoading = categoriesLoading || articlesLoading;

  return {
    categories,
    articles,
    categoryMap,
    articleMap,
    getCategoryLabel,
    getArticlesForCategory,
    getArticleLabel,
    getCategoryTotalStock,
    lowStockArticles,
    isLoading,
  };
}
