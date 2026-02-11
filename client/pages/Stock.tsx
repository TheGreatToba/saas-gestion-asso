import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Package,
  Edit,
  Trash2,
  RotateCcw,
  TrendingDown,
  AlertTriangle,
  Layers,
  ChevronRight,
  PackagePlus,
  Filter,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import type { Article } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";

type StockFilter = "all" | "low" | "empty" | "ok";

export default function Stock() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const {
    categories,
    articles,
    getCategoryLabel,
    getArticlesForCategory,
    lowStockArticles,
  } = useCategories();

  // ═══════ Search & Filters ═══════
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<StockFilter>("all");

  // ═══════ Category form state ═══════
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; description?: string } | null>(null);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");

  // ═══════ Article form state ═══════
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [articleFormCatId, setArticleFormCatId] = useState("");
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [artName, setArtName] = useState("");
  const [artDescription, setArtDescription] = useState("");
  const [artUnit, setArtUnit] = useState("unités");
  const [artStockQuantity, setArtStockQuantity] = useState(0);
  const [artStockMin, setArtStockMin] = useState(0);

  // ═══════ Restock state ═══════
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [restockArticle, setRestockArticle] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [restockDelta, setRestockDelta] = useState(0);

  // ═══════ Mutations ═══════

  const createCatMutation = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowCatForm(false);
      resetCatForm();
      toast({ title: "Catégorie créée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string }) =>
      api.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCat(null);
      setShowCatForm(false);
      resetCatForm();
      toast({ title: "Catégorie mise à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteCatMutation = useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast({ title: "Catégorie supprimée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: api.createArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      setShowArticleForm(false);
      resetArticleForm();
      toast({ title: "Article créé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string; unit?: string; stockQuantity?: number; stockMin?: number }) =>
      api.updateArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      setShowArticleForm(false);
      setEditingArticle(null);
      resetArticleForm();
      toast({ title: "Article mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: api.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast({ title: "Article supprimé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.adjustArticleStock(id, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      setShowRestockDialog(false);
      setRestockArticle(null);
      setRestockDelta(0);
      toast({ title: "Stock mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // ═══════ Helpers ═══════

  const resetCatForm = () => { setCatName(""); setCatDescription(""); };
  const resetArticleForm = () => { setArtName(""); setArtDescription(""); setArtUnit("unités"); setArtStockQuantity(0); setArtStockMin(0); setArticleFormCatId(""); };

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    if (editingCat) {
      updateCatMutation.mutate({ id: editingCat.id, name: catName.trim(), description: catDescription.trim() });
    } else {
      createCatMutation.mutate({ name: catName.trim(), description: catDescription.trim() });
    }
  };

  const handleArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artName.trim()) return;
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, name: artName.trim(), description: artDescription.trim(), unit: artUnit.trim() || "unités", stockQuantity: artStockQuantity, stockMin: artStockMin });
    } else {
      createArticleMutation.mutate({ categoryId: articleFormCatId, name: artName.trim(), description: artDescription.trim(), unit: artUnit.trim() || "unités", stockQuantity: artStockQuantity, stockMin: artStockMin });
    }
  };

  const openNewArticle = (catId: string) => {
    setEditingArticle(null);
    resetArticleForm();
    setArticleFormCatId(catId); // après reset pour que la catégorie cliquée reste présélectionnée
    setShowArticleForm(true);
  };

  const openEditArticle = (art: Article) => {
    setEditingArticle(art);
    setArticleFormCatId(art.categoryId);
    setArtName(art.name);
    setArtDescription(art.description || "");
    setArtUnit(art.unit || "unités");
    setArtStockQuantity(art.stockQuantity);
    setArtStockMin(art.stockMin);
    setShowArticleForm(true);
  };

  const openRestock = (art: Article) => {
    setRestockArticle({ id: art.id, name: art.name, unit: art.unit || "unités" });
    setRestockDelta(0);
    setShowRestockDialog(true);
  };

  // ═══════ Filtered data ═══════

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (filterCategory !== "all" && cat.id !== filterCategory) return false;
      const catArticles = getArticlesForCategory(cat.id);
      const q = search.toLowerCase();
      if (q) {
        const catMatch = cat.name.toLowerCase().includes(q) || cat.description?.toLowerCase().includes(q);
        const anyArticleMatch = catArticles.some(
          (a) => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
        );
        if (!catMatch && !anyArticleMatch) return false;
      }
      if (filterStock !== "all") {
        if (filterStock === "empty") {
          if (!catArticles.some((a) => a.stockMin > 0 && a.stockQuantity === 0)) return false;
        } else if (filterStock === "low") {
          if (!catArticles.some((a) => a.stockMin > 0 && a.stockQuantity > 0 && a.stockQuantity <= a.stockMin)) return false;
        } else if (filterStock === "ok") {
          if (!catArticles.some((a) => a.stockMin === 0 || a.stockQuantity > a.stockMin)) return false;
        }
      }
      return true;
    });
  }, [categories, search, filterCategory, filterStock, articles]);

  // For a category, return filtered articles
  const getFilteredArticles = (catId: string) => {
    const catArticles = getArticlesForCategory(catId);
    const q = search.toLowerCase();
    return catArticles.filter((art) => {
      if (q && !art.name.toLowerCase().includes(q) && !art.description?.toLowerCase().includes(q)) {
        // Still show if parent category name matches
        const cat = categories.find((c) => c.id === catId);
        if (!cat?.name.toLowerCase().includes(q)) return false;
      }
      if (filterStock === "empty" && !(art.stockMin > 0 && art.stockQuantity === 0)) return false;
      if (filterStock === "low" && !(art.stockMin > 0 && art.stockQuantity > 0 && art.stockQuantity <= art.stockMin)) return false;
      if (filterStock === "ok" && !(art.stockMin === 0 || art.stockQuantity > art.stockMin)) return false;
      return true;
    });
  };

  // Stats
  const totalArticles = articles.length;
  const totalStock = articles.reduce((s, a) => s + a.stockQuantity, 0);
  const emptyCount = articles.filter((a) => a.stockMin > 0 && a.stockQuantity === 0).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Stock</h1>
            <p className="text-muted-foreground mt-1">
              {categories.length} catégorie{categories.length !== 1 ? "s" : ""},{" "}
              {totalArticles} article{totalArticles !== 1 ? "s" : ""},{" "}
              <span className="font-medium text-foreground">{totalStock}</span> unités en stock
              {emptyCount > 0 && (
                <span className="text-red-600 font-medium ml-1">
                  · {emptyCount} en rupture
                </span>
              )}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => { setShowCatForm(true); setEditingCat(null); resetCatForm(); }}
              >
                <Plus className="w-4 h-4" />
                Catégorie
              </Button>
              <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (categories.length === 0) {
                    toast({ title: "Créez d'abord une catégorie", variant: "destructive" });
                    return;
                  }
                  setArticleFormCatId(categories[0].id);
                  setEditingArticle(null);
                  resetArticleForm();
                  setShowArticleForm(true);
                }}
              >
                <PackagePlus className="w-4 h-4" />
                Nouvel article
              </Button>
            </div>
          )}
        </div>

        {/* Low stock banner */}
        {lowStockArticles.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 mb-1">
                {lowStockArticles.length} article{lowStockArticles.length !== 1 ? "s" : ""} en alerte stock
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStockArticles.slice(0, 8).map((art) => (
                  <button
                    key={art.id}
                    onClick={() => openRestock(art)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition hover:ring-2 hover:ring-blue-200 ${
                      art.stockQuantity === 0
                        ? "bg-red-100 border-red-300 text-red-700"
                        : "bg-orange-100 border-orange-300 text-orange-700"
                    }`}
                  >
                    <span>{getCategoryLabel(art.categoryId)}</span>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    <span>{art.name}</span>
                    <Badge variant={art.stockQuantity === 0 ? "destructive" : "secondary"} className="text-[10px] px-1 py-0 ml-1">
                      {art.stockQuantity === 0 ? "0" : art.stockQuantity} {art.unit}
                    </Badge>
                  </button>
                ))}
                {lowStockArticles.length > 8 && (
                  <span className="text-xs text-orange-600 self-center">+{lowStockArticles.length - 8} autres</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un article ou une catégorie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStock} onValueChange={(v) => setFilterStock(v as StockFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout stock</SelectItem>
                  <SelectItem value="empty">Rupture</SelectItem>
                  <SelectItem value="low">Stock faible</SelectItem>
                  <SelectItem value="ok">Stock OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Categories & Articles */}
        <div className="space-y-4">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              {search || filterStock !== "all" || filterCategory !== "all" ? (
                <>
                  <Filter className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucun résultat pour ces filtres</p>
                  <Button variant="ghost" className="mt-2" onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStock("all"); }}>
                    Réinitialiser les filtres
                  </Button>
                </>
              ) : (
                <>
                  <PackagePlus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucune catégorie. Créez votre première catégorie d'aide.</p>
                </>
              )}
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const catArticles = getFilteredArticles(cat.id);
              const allCatArticles = getArticlesForCategory(cat.id);
              const totalStock = allCatArticles.reduce((s, a) => s + a.stockQuantity, 0);
              const hasLow = allCatArticles.some((a) => a.stockMin > 0 && a.stockQuantity <= a.stockMin);

              return (
                <div key={cat.id} className={`bg-white rounded-lg border overflow-hidden shadow-sm ${hasLow ? "border-orange-200" : "border-gray-200"}`}>
                  {/* Category header */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <Layers className="w-5 h-5 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">{cat.name}</h3>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {allCatArticles.length} article{allCatArticles.length !== 1 ? "s" : ""} · {totalStock} en stock
                      </Badge>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-blue-600 hover:text-blue-800" onClick={() => openNewArticle(cat.id)}>
                          <Plus className="w-3.5 h-3.5" />
                          Article
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingCat({ id: cat.id, name: cat.name, description: cat.description });
                            setCatName(cat.name);
                            setCatDescription(cat.description || "");
                            setShowCatForm(true);
                          }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => { if (confirm(`Supprimer "${cat.name}" et tous ses articles ?`)) deleteCatMutation.mutate(cat.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Articles table */}
                  {catArticles.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {catArticles.map((art) => {
                        const isEmpty = art.stockMin > 0 && art.stockQuantity === 0;
                        const isLow = art.stockMin > 0 && art.stockQuantity <= art.stockMin && !isEmpty;
                        return (
                          <div key={art.id} className={`flex items-center gap-4 px-5 py-3 ${isEmpty ? "bg-red-50/50" : isLow ? "bg-orange-50/50" : "hover:bg-gray-50/50"} transition`}>
                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">{art.name}</span>
                                {isEmpty && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Rupture</Badge>
                                )}
                                {isLow && !isEmpty && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-orange-600 bg-orange-100 border-orange-200 shrink-0">Stock faible</Badge>
                                )}
                              </div>
                              {art.description && (
                                <p className="text-xs text-muted-foreground ml-6 truncate">{art.description}</p>
                              )}
                            </div>

                            {/* Stock bar + numbers */}
                            <div className="w-48 shrink-0">
                              {art.stockMin > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                  <div
                                    className={`h-2 rounded-full transition-all ${isEmpty ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-green-500"}`}
                                    style={{ width: `${Math.min(100, art.stockMin > 0 ? (art.stockQuantity / (art.stockMin * 3)) * 100 : 100)}%` }}
                                  />
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs">
                                <span className={`font-semibold ${isEmpty ? "text-red-600" : isLow ? "text-orange-600" : "text-foreground"}`}>
                                  {art.stockQuantity} {art.unit}
                                </span>
                                {art.stockMin > 0 && (
                                  <span className="text-muted-foreground">seuil: {art.stockMin}</span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => openRestock(art)}>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Réappro.
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditArticle(art)}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => { if (confirm(`Supprimer "${art.name}" ?`)) deleteArticleMutation.mutate(art.id); }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-4 text-sm text-muted-foreground italic">
                      {search || filterStock !== "all"
                        ? "Aucun article ne correspond aux filtres"
                        : "Aucun article — ajoutez des variantes pour suivre le stock"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ═══════ DIALOGS ═══════ */}

        {/* Category Create/Edit */}
        <Dialog open={showCatForm} onOpenChange={() => { setShowCatForm(false); setEditingCat(null); resetCatForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCat ? "Modifier la catégorie" : "Nouvelle catégorie d'aide"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex: Nourriture, Couches, Vêtements..." required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={catDescription} onChange={(e) => setCatDescription(e.target.value)} placeholder="Détails sur cette catégorie..." />
              </div>
              <p className="text-xs text-muted-foreground">
                La catégorie regroupe des articles (variantes). Le stock sera géré au niveau de chaque article.
              </p>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowCatForm(false); setEditingCat(null); resetCatForm(); }}>Annuler</Button>
                <Button type="submit" disabled={createCatMutation.isPending || updateCatMutation.isPending}>
                  {editingCat ? "Mettre à jour" : "Créer la catégorie"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Article Create/Edit */}
        <Dialog open={showArticleForm} onOpenChange={(open) => { if (!open) { setShowArticleForm(false); setEditingArticle(null); resetArticleForm(); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingArticle ? "Modifier l'article" : "Nouvel article"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleArticleSubmit} className="space-y-4">
              {!editingArticle && (
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <Select value={articleFormCatId} onValueChange={setArticleFormCatId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Nom de l'article *</Label>
                <Input value={artName} onChange={(e) => setArtName(e.target.value)} placeholder="Ex: Pack 1kg, Taille 3, Couverture polaire..." required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={artDescription} onChange={(e) => setArtDescription(e.target.value)} placeholder="Détails..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Input value={artUnit} onChange={(e) => setArtUnit(e.target.value)} placeholder="unités" />
                </div>
                <div className="space-y-2">
                  <Label>Stock initial</Label>
                  <Input type="number" min={0} value={artStockQuantity} onChange={(e) => setArtStockQuantity(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Seuil alerte</Label>
                  <Input type="number" min={0} value={artStockMin} onChange={(e) => setArtStockMin(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Le seuil d'alerte affiche un avertissement quand le stock passe en dessous.
              </p>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setShowArticleForm(false); setEditingArticle(null); resetArticleForm(); }}>Annuler</Button>
                <Button type="submit" disabled={createArticleMutation.isPending || updateArticleMutation.isPending || (!editingArticle && !articleFormCatId)}>
                  {editingArticle ? "Mettre à jour" : "Créer l'article"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Restock Dialog */}
        <Dialog open={showRestockDialog} onOpenChange={() => { setShowRestockDialog(false); setRestockArticle(null); setRestockDelta(0); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Réapprovisionner</DialogTitle>
            </DialogHeader>
            {restockArticle && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ajouter du stock pour <span className="font-semibold text-foreground">{restockArticle.name}</span>
                </p>
                <div className="space-y-2">
                  <Label>Quantité à ajouter ({restockArticle.unit})</Label>
                  <Input type="number" min={1} value={restockDelta || ""} onChange={(e) => setRestockDelta(parseInt(e.target.value) || 0)} placeholder="Quantité reçue..." autoFocus />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => { setShowRestockDialog(false); setRestockArticle(null); }}>Annuler</Button>
                  <Button disabled={restockDelta <= 0 || adjustStockMutation.isPending}
                    onClick={() => { if (restockArticle && restockDelta > 0) adjustStockMutation.mutate({ id: restockArticle.id, delta: restockDelta }); }}>
                    Ajouter au stock
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
