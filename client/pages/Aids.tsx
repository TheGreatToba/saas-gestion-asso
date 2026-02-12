import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Gift,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  Package,
  X,
  Trash2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import { NEED_STATUS_LABELS } from "@shared/schema";
import type { AidSource, EnrichedNeed, CreateAidClientInput } from "@shared/schema";
import { statusBadgeClasses } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function Aids() {
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deleteAidId, setDeleteAidId] = useState<string | null>(null);
  const {
    categories,
    articles,
    getCategoryLabel,
    getArticlesForCategory,
    getArticleLabel,
  } = useCategories();

  // ═══════ Quick-add state ═══════
  const preselectedFamily = searchParams.get("familyId") || "";
  const preselectedType = searchParams.get("type") || "";
  const [showAddDialog, setShowAddDialog] = useState(
    searchParams.get("action") === "add" || !!preselectedFamily
  );
  const [selectedFamilyId, setSelectedFamilyId] = useState(preselectedFamily);
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [aidItems, setAidItems] = useState<
    { id: string; categoryId: string; articleId: string; quantity: number }[]
  >(() => [
    {
      id: "item-1",
      categoryId: preselectedType,
      articleId: "",
      quantity: 1,
    },
  ]);
  const source: AidSource = "donation";
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  // ═══════ List filter state ═══════
  const [filterType, setFilterType] = useState<string>("all");
  const [listSearch, setListSearch] = useState("");

  // ═══════ Data queries ═══════
  const { data: aidsData, isLoading, error } = useQuery({
    queryKey: ["aids-all"],
    queryFn: () => api.getAids({ limit: 500, offset: 0 }),
  });
  const aids = aidsData?.items ?? [];

  const { data: familiesData } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies({ limit: 500, offset: 0 }),
  });
  const families = familiesData?.items ?? [];

  const { data: familyNeeds = [] } = useQuery({
    queryKey: ["family-needs", selectedFamilyId],
    queryFn: () => api.getNeedsByFamily(selectedFamilyId),
    enabled: !!selectedFamilyId,
  });

  const { data: familyAids = [] } = useQuery({
    queryKey: ["family-aids", selectedFamilyId],
    queryFn: () => api.getAidsByFamily(selectedFamilyId),
    enabled: !!selectedFamilyId,
  });

  const familyMap = new Map(families.map((f) => [f.id, f]));
  const selectedFamily = selectedFamilyId ? familyMap.get(selectedFamilyId) : null;
  const pendingNeeds = familyNeeds.filter((n) => n.status !== "covered");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentFamilyAids = familyAids
    .filter((a) => new Date(a.date) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentlyGivenTypes = new Set(recentFamilyAids.map((a) => a.type));

  const filteredFamilies = useMemo(() => {
    if (!familySearch) return families;
    const q = familySearch.toLowerCase();
    return families.filter(
      (f) =>
        f.responsibleName.toLowerCase().includes(q) ||
        f.neighborhood.toLowerCase().includes(q) ||
        f.phone.includes(q)
    );
  }, [families, familySearch]);

  // ═══════ Mutations ═══════

  const createMutation = useMutation({
    mutationFn: async (payloads: CreateAidClientInput[]) => {
      return Promise.all(payloads.map((payload) => api.createAid(payload)));
    },
    onSuccess: (_data, payloads) => {
      queryClient.invalidateQueries({ queryKey: ["aids-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["family-aids", selectedFamilyId] });
      queryClient.invalidateQueries({ queryKey: ["family-needs", selectedFamilyId] });
      setAidItems([{ id: "item-1", categoryId: "", articleId: "", quantity: 1 }]);
      setNotes("");
      setProofUrl("");
      setShowDetails(false);
      setShowAddDialog(false);
      toast({
        title: "Aide enregistrée !",
        description: `${selectedFamily?.responsibleName} — ${payloads.length} aide${payloads.length > 1 ? "s" : ""} ajoutée${payloads.length > 1 ? "s" : ""}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aids-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Aide supprimée" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ═══════ Helpers ═══════

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamilyId || !canSubmit) return;
    const payloads: CreateAidClientInput[] = aidItems
      .filter((item) => item.categoryId)
      .map((item) => ({
        familyId: selectedFamilyId,
        type: item.categoryId,
        articleId: item.articleId || "",
        quantity: item.quantity,
        date: new Date().toISOString(),
        source,
        notes,
        proofUrl,
      }));
    if (payloads.length === 0) return;
    createMutation.mutate(payloads);
  };

  const selectNeedAsType = (need: EnrichedNeed) => {
    setAidItems((prev) => {
      const emptyIndex = prev.findIndex((item) => !item.categoryId);
      if (emptyIndex === -1) {
        return [
          ...prev,
          {
            id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            categoryId: need.type,
            articleId: "",
            quantity: 1,
          },
        ];
      }
      return prev.map((item, idx) =>
        idx === emptyIndex
          ? { ...item, categoryId: need.type, articleId: "" }
          : item
      );
    });
    if (need.details) {
      setNotes(need.details);
      setShowDetails(true);
    }
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setSelectedFamilyId("");
    setAidItems([{ id: "item-1", categoryId: "", articleId: "", quantity: 1 }]);
    setNotes("");
    setProofUrl("");
    setShowDetails(false);
    setFamilySearch("");
  };

  // ═══════ Filters ═══════

  const filtered = aids.filter((aid) => {
    if (filterType !== "all" && aid.type !== filterType) return false;
    if (listSearch) {
      const family = familyMap.get(aid.familyId);
      const q = listSearch.toLowerCase();
      if (
        !family?.responsibleName.toLowerCase().includes(q) &&
        !family?.neighborhood.toLowerCase().includes(q) &&
        !aid.volunteerName.toLowerCase().includes(q) &&
        !getCategoryLabel(aid.type).toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const aidsThisMonth = aids.filter((a) => new Date(a.date) >= thisMonth);
  const totalQuantityThisMonth = aidsThisMonth.reduce((sum, a) => sum + a.quantity, 0);

  const updateAidItem = (
    id: string,
    patch: Partial<{ categoryId: string; articleId: string; quantity: number }>
  ) => {
    setAidItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const addAidItem = () => {
    setAidItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: "",
        articleId: "",
        quantity: 1,
      },
    ]);
  };

  const removeAidItem = (id: string) => {
    setAidItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const isItemComplete = (item: {
    categoryId: string;
    articleId: string;
    quantity: number;
  }) => {
    if (!item.categoryId) return false;
    const articles = getArticlesForCategory(item.categoryId);
    if (articles.length > 0 && !item.articleId) return false;
    return item.quantity >= 1;
  };

  const canSubmit =
    !!selectedFamilyId &&
    aidItems.length > 0 &&
    aidItems.every((item) => isItemComplete(item));

  const selectedCategoryIds = aidItems
    .map((item) => item.categoryId)
    .filter((id) => id);
  const redundantSelected = selectedCategoryIds.filter((id) =>
    recentlyGivenTypes.has(id)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <ConfirmDialog
        open={!!deleteAidId}
        onOpenChange={(open) => !open && setDeleteAidId(null)}
        title="Supprimer cette aide ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={() => deleteAidId && deleteMutation.mutate(deleteAidId)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aides</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? (
                <>
                  {aids.length} aide{aids.length !== 1 ? "s" : ""} enregistrée{aids.length !== 1 ? "s" : ""}
                  {" — "}
                  <span className="text-green-600 font-medium">
                    {aidsThisMonth.length} ce mois ({totalQuantityThisMonth} unités)
                  </span>
                </>
              ) : (
                "Enregistrez les aides apportées aux familles"
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto" size="lg">
              <Zap className="w-5 h-5" />
              Enregistrer une aide
            </Button>
          </div>
        </div>

        {/* ═══════════ ADD AID DIALOG ═══════════ */}
        <Dialog open={showAddDialog} onOpenChange={(open) => (open ? setShowAddDialog(true) : closeAddDialog())}>
          <DialogContent className="max-w-lg min-h-[75vh] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                Enregistrer une aide
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleQuickSubmit} className="space-y-6 pt-2">
              {/* Step 1: Select Family */}
              <div className="mb-6">
                <Label className="text-base font-semibold mb-2 block">1. Choisir la famille</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="Tapez le nom ou quartier..."
                    value={selectedFamily ? `${selectedFamily.number > 0 ? `Famille N° ${selectedFamily.number}` : "Famille"}${selectedFamily.responsibleName ? ` — ${selectedFamily.responsibleName}` : ""} — ${selectedFamily.neighborhood}` : familySearch}
                    onChange={(e) => { setFamilySearch(e.target.value); setSelectedFamilyId(""); setShowFamilyDropdown(true); }}
                    onFocus={() => { if (!selectedFamilyId) setShowFamilyDropdown(true); }}
                    className="pl-10 h-12 text-base"
                  />
                  {selectedFamilyId && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedFamilyId("");
                        setFamilySearch("");
                        setAidItems([
                          { id: "item-1", categoryId: "", articleId: "", quantity: 1 },
                        ]);
                        setShowFamilyDropdown(true);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showFamilyDropdown && !selectedFamilyId && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredFamilies.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">Aucune famille trouvée</p>
                      ) : (
                        filteredFamilies.map((f) => (
                          <button key={f.id} type="button" className="w-full text-left px-4 py-3 hover:bg-green-50 transition flex justify-between items-center border-b last:border-b-0"
                            onClick={() => { setSelectedFamilyId(f.id); setFamilySearch(""); setShowFamilyDropdown(false); }}>
                            <div>
                              <p className="font-medium">{f.number > 0 ? `Famille N° ${f.number}` : "Famille"}{f.responsibleName ? ` — ${f.responsibleName}` : ""}</p>
                              <p className="text-sm text-muted-foreground">{f.neighborhood} — {f.memberCount} membres, {f.childrenCount} enfant{f.childrenCount !== 1 ? "s" : ""}</p>
                            </div>
                            <Badge variant="outline" className={`shrink-0 ml-2 ${
                              f.housing === "housed" ? "bg-green-100 text-green-800 border-green-300"
                                : f.housing === "pending_placement" ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-red-100 text-red-800 border-red-300"
                            }`}>
                              {f.housing === "housed" ? "Hébergé" : f.housing === "pending_placement" ? "En attente" : "Sans hébergement"}
                              {f.housingName && ` — ${f.housingName}`}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Family Context */}
              {selectedFamily && (
                <div className="mb-6 space-y-4">
                  {pendingNeeds.length > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <p className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Besoins en attente ({pendingNeeds.length})
                        <span className="font-normal text-orange-600">— cliquez pour enregistrer</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                  {pendingNeeds.map((need) => {
                    const alreadySelected = selectedCategoryIds.includes(need.type);
                    return (
                      <button
                        key={need.id}
                        type="button"
                        onClick={() => selectNeedAsType(need)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          alreadySelected
                            ? "bg-green-100 border-green-400 text-green-800 ring-2 ring-green-300"
                            : "bg-white border-orange-200 text-orange-800 hover:bg-orange-100"
                        }`}
                      >
                        {alreadySelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {getCategoryLabel(need.type)}
                        {need.details && (
                          <span className="text-xs opacity-75">({need.details})</span>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${statusBadgeClasses(need.status)}`}
                        >
                          {NEED_STATUS_LABELS[need.status]}
                        </Badge>
                      </button>
                    );
                  })}
                      </div>
                    </div>
                  )}

                  {recentFamilyAids.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Déjà donné récemment
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentFamilyAids.slice(0, 6).map((aid) => (
                          <span key={aid.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-blue-100 text-blue-700 border border-blue-200">
                            {aid.articleId ? getArticleLabel(aid.articleId) : getCategoryLabel(aid.type)} x{aid.quantity}
                            <span className="opacity-60">({formatDistanceToNow(new Date(aid.date), { addSuffix: false, locale: fr })})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingNeeds.length === 0 && recentFamilyAids.length === 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                      <p className="text-sm text-muted-foreground">Aucun besoin en attente et aucune aide récente pour cette famille.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Category + Article selection */}
              {selectedFamilyId && (
                <>
                  <div className="mb-4">
                    <Label className="text-base font-semibold mb-2 block">
                      2. Catégories d'aide
                      {pendingNeeds.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">(ou sélectionnez un besoin ci-dessus)</span>
                      )}
                    </Label>
                    <div className="space-y-3">
                      {aidItems.map((item, index) => {
                        const articles = item.categoryId
                          ? getArticlesForCategory(item.categoryId)
                          : [];
                        const needsArticle = articles.length > 0;
                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                          >
                            <div className="sm:col-span-4 space-y-1">
                              <Label className="text-sm">
                                {index === 0 ? "Catégorie *" : "Catégorie"}
                              </Label>
                              <Select
                                value={item.categoryId}
                                onValueChange={(value) =>
                                  updateAidItem(item.id, {
                                    categoryId: value,
                                    articleId: "",
                                  })
                                }
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Choisir une catégorie" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories
                                    .filter((cat) => cat.id != null && cat.id !== "")
                                    .map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-5 space-y-1">
                              <Label className="text-sm">
                                {needsArticle ? "Article *" : "Article"}
                              </Label>
                              <Select
                                value={item.articleId}
                                onValueChange={(value) =>
                                  updateAidItem(item.id, { articleId: value })
                                }
                                disabled={!item.categoryId || articles.length === 0}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue
                                    placeholder={
                                      !item.categoryId
                                        ? "Choisir une catégorie d'abord"
                                        : articles.length === 0
                                        ? "Aucun article pour cette catégorie"
                                        : "Choisir un article"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {articles.length === 0 && (
                                    <SelectItem value="none" disabled>
                                      Aucun article disponible
                                    </SelectItem>
                                  )}
                                  {articles
                                    .filter((art) => art.id != null && art.id !== "")
                                    .map((art) => (
                                      <SelectItem key={art.id} value={art.id}>
                                        {art.name} — {art.stockQuantity} {art.unit}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-sm">Quantité *</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateAidItem(item.id, {
                                    quantity: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="h-11"
                              />
                            </div>
                            <div className="sm:col-span-1 flex sm:justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAidItem(item.id)}
                                className="text-muted-foreground"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <div>
                        <Button type="button" variant="outline" onClick={addAidItem}>
                          Ajouter une catégorie
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Optional details */}
                  <div className="mb-4">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-muted-foreground gap-1">
                      {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showDetails ? "Masquer les détails" : "Détails optionnels"}
                    </Button>
                  </div>

                  {showDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm">Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Détails de l'aide..." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Preuve (image)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            if (!file) {
                              setProofUrl("");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = typeof reader.result === "string" ? reader.result : "";
                              setProofUrl(result);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        {proofUrl.startsWith("data:image/") && (
                          <img
                            src={proofUrl}
                            alt="Preuve"
                            className="mt-2 h-24 w-auto rounded border border-gray-200"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center flex-wrap">
                    <Button type="submit" size="lg" disabled={!canSubmit || createMutation.isPending}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 gap-2 h-12 px-8 text-base">
                      {createMutation.isPending ? "Enregistrement..." : (
                        <><Gift className="w-5 h-5" />Enregistrer l'aide</>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeAddDialog}>
                      Annuler
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => { setSelectedFamilyId(""); setAidItems([{ id: "item-1", categoryId: "", articleId: "", quantity: 1 }]); setNotes(""); setProofUrl(""); setShowDetails(false); setFamilySearch(""); }} className="text-muted-foreground">
                      Réinitialiser
                    </Button>
                    {redundantSelected.length > 0 && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {redundantSelected.length > 1
                          ? "Certaines catégories ont déjà été données récemment"
                          : "Cette catégorie a déjà été donnée récemment"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* ═══════════ STATS (admin) ═══════════ */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {categories.slice(0, 4).map((cat) => {
              const count = aidsThisMonth.filter((a) => a.type === cat.id).length;
              return (
                <div key={cat.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-muted-foreground">{cat.name}</p>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">ce mois</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════ SEARCH + FILTERS ═══════════ */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher dans l'historique..." value={listSearch} onChange={(e) => setListSearch(e.target.value)} className="pl-10" />
            </div>
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout type</SelectItem>
                    {categories
                      .filter((cat) => cat.id != null && cat.id !== "")
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-6">
            Impossible de charger les aides.
          </div>
        )}

        {/* ═══════════ AIDS LIST ═══════════ */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Gift className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">Aucune aide trouvée</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((aid) => {
              const family = familyMap.get(aid.familyId);
              return (
                <div key={aid.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Gift className="w-4 h-4 text-green-600" />
                        <span className="font-semibold">{getCategoryLabel(aid.type)}</span>
                        {aid.articleId && (
                          <span className="text-sm text-muted-foreground">› {articles.find((a) => a.id === aid.articleId)?.name || ""}</span>
                        )}
                        <Badge variant="secondary">x{aid.quantity}</Badge>
                      </div>
                      {family && (
                        <Link to={`/families/${family.id}`} className="text-sm text-primary hover:underline">
                          {family.number > 0 ? `Famille N° ${family.number}` : "Famille"}{family.responsibleName ? ` — ${family.responsibleName}` : ""} — {family.neighborhood}
                        </Link>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">Par {aid.volunteerName}</p>
                      {aid.notes && <p className="text-xs text-muted-foreground mt-1">{aid.notes}</p>}
                      {aid.proofUrl && (
                        aid.proofUrl.startsWith("data:image/") ? (
                          <img
                            src={aid.proofUrl}
                            alt="Preuve"
                            className="mt-2 h-16 w-auto rounded border border-gray-200"
                          />
                        ) : (
                          <a
                            href={aid.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          >
                            Voir la preuve
                          </a>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(aid.date), "d MMM yyyy", { locale: fr })}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteAidId(aid.id)}
                          aria-label="Supprimer l'aide"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
