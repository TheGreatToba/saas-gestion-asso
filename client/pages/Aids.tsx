import { useState, useMemo } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Gift,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  Package,
  X,
  Tags,
  Edit,
  Trash2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import {
  AID_SOURCE_LABELS,
  NEED_URGENCY_LABELS,
  NEED_STATUS_LABELS,
} from "@shared/schema";
import type { AidSource, Need } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Aids() {
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { categories, getCategoryLabel } = useCategories();

  // Quick-add state
  const preselectedFamily = searchParams.get("familyId") || "";
  const [showQuickAdd, setShowQuickAdd] = useState(
    searchParams.get("action") === "add" || !!preselectedFamily
  );
  const [selectedFamilyId, setSelectedFamilyId] = useState(preselectedFamily);
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<AidSource>("donation");
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  // Category management state (admin)
  const [showCatSection, setShowCatSection] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [catName, setCatName] = useState("");

  // List filter state
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [listSearch, setListSearch] = useState("");

  // Data queries
  const { data: aids = [], isLoading } = useQuery({
    queryKey: ["aids-all"],
    queryFn: api.getAids,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies(),
  });

  // Family context queries — only when a family is selected
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
  const selectedFamily = selectedFamilyId
    ? familyMap.get(selectedFamilyId)
    : null;

  // Pending needs (not covered)
  const pendingNeeds = familyNeeds.filter((n) => n.status !== "covered");

  // Recent aids (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentFamilyAids = familyAids
    .filter((a) => new Date(a.date) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Redundancy check: what types have already been given recently
  const recentlyGivenTypes = new Set(recentFamilyAids.map((a) => a.type));

  // Filtered family search
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: api.createAid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aids-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({
        queryKey: ["family-aids", selectedFamilyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["family-needs", selectedFamilyId],
      });
      // Reset form but keep family selected for multiple aids
      setSelectedType("");
      setQuantity(1);
      setSource("donation");
      setNotes("");
      setProofUrl("");
      setShowDetails(false);
      toast({
        title: "Aide enregistrée !",
        description: `${selectedFamily?.responsibleName} — ${
          selectedType ? getCategoryLabel(selectedType) : ""
        }`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Category mutations (admin)
  const createCatMutation = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowCatForm(false);
      setCatName("");
      toast({ title: "Catégorie créée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.updateCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCat(null);
      setCatName("");
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
      toast({ title: "Catégorie supprimée" });
    },
  });

  const handleCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    if (editingCat) {
      updateCatMutation.mutate({ id: editingCat.id, name: catName.trim() });
    } else {
      createCatMutation.mutate({ name: catName.trim() });
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamilyId || !selectedType) return;
    createMutation.mutate({
      familyId: selectedFamilyId,
      type: selectedType,
      quantity,
      date: new Date().toISOString(),
      volunteerId: user?.id || "",
      volunteerName: user?.name || "",
      source,
      notes,
      proofUrl,
    });
  };

  const selectNeedAsType = (need: Need) => {
    setSelectedType(need.type);
    if (need.details) {
      setNotes(need.details);
      setShowDetails(true);
    }
  };

  const resetQuickAdd = () => {
    setSelectedFamilyId("");
    setSelectedType("");
    setQuantity(1);
    setSource("donation");
    setNotes("");
    setProofUrl("");
    setShowDetails(false);
    setFamilySearch("");
  };

  // Filter aids for list
  const filtered = aids.filter((aid) => {
    if (filterType !== "all" && aid.type !== filterType) return false;
    if (filterSource !== "all" && aid.source !== filterSource) return false;
    if (listSearch) {
      const family = familyMap.get(aid.familyId);
      const q = listSearch.toLowerCase();
      if (
        !family?.responsibleName.toLowerCase().includes(q) &&
        !family?.neighborhood.toLowerCase().includes(q) &&
        !aid.volunteerName.toLowerCase().includes(q) &&
        !getCategoryLabel(aid.type).toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Stats
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const aidsThisMonth = aids.filter((a) => new Date(a.date) >= thisMonth);
  const totalQuantityThisMonth = aidsThisMonth.reduce(
    (sum, a) => sum + a.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aides</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? (
                <>
                  {aids.length} aide{aids.length !== 1 ? "s" : ""} enregistrée
                  {aids.length !== 1 ? "s" : ""}
                  {" — "}
                  <span className="text-green-600 font-medium">
                    {aidsThisMonth.length} ce mois ({totalQuantityThisMonth}{" "}
                    unités)
                  </span>
                </>
              ) : (
                "Enregistrez les aides apportées aux familles"
              )}
            </p>
          </div>
          {!showQuickAdd && (
            <Button
              onClick={() => setShowQuickAdd(true)}
              className="gap-2 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Zap className="w-5 h-5" />
              Enregistrer une aide
            </Button>
          )}
        </div>

        {/* ═══════════ CATEGORY MANAGEMENT (admin) ═══════════ */}
        {isAdmin && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowCatSection(!showCatSection)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-3"
            >
              <Tags className="w-4 h-4" />
              <span className="font-medium">
                Gérer les catégories d'aide ({categories.length})
              </span>
              {showCatSection ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showCatSection && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground">
                    Ces catégories apparaissent dans les formulaires de besoins
                    et d'aides.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0 ml-4"
                    onClick={() => {
                      setShowCatForm(true);
                      setEditingCat(null);
                      setCatName("");
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nouvelle catégorie
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="inline-flex items-center gap-2 pl-3 pr-1 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    >
                      <span className="font-medium">{cat.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEditingCat(cat);
                          setCatName(cat.name);
                          setShowCatForm(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (
                            confirm(`Supprimer "${cat.name}" ?`)
                          ) {
                            deleteCatMutation.mutate(cat.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Create/Edit Dialog */}
            <Dialog
              open={showCatForm}
              onOpenChange={() => {
                setShowCatForm(false);
                setEditingCat(null);
                setCatName("");
              }}
            >
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>
                    {editingCat
                      ? "Modifier la catégorie"
                      : "Nouvelle catégorie"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCatSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Ex: Produits d'hygiène, Fournitures scolaires..."
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCatForm(false);
                        setEditingCat(null);
                        setCatName("");
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createCatMutation.isPending ||
                        updateCatMutation.isPending
                      }
                    >
                      {editingCat ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════════ QUICK-ADD PANEL ═══════════ */}
        {showQuickAdd && (
          <div className="bg-white rounded-xl border-2 border-green-200 shadow-lg mb-8 overflow-hidden">
            {/* Panel header */}
            <div className="bg-green-50 px-6 py-4 flex items-center justify-between border-b border-green-200">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-green-800">
                  Enregistrement rapide
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowQuickAdd(false);
                  resetQuickAdd();
                }}
                className="text-green-700 hover:text-green-900"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleQuickSubmit} className="p-6">
              {/* Step 1: Select Family */}
              <div className="mb-6">
                <Label className="text-base font-semibold mb-2 block">
                  1. Choisir la famille
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="Tapez le nom ou quartier..."
                    value={
                      selectedFamily
                        ? `${selectedFamily.responsibleName} — ${selectedFamily.neighborhood}`
                        : familySearch
                    }
                    onChange={(e) => {
                      setFamilySearch(e.target.value);
                      setSelectedFamilyId("");
                      setShowFamilyDropdown(true);
                    }}
                    onFocus={() => {
                      if (!selectedFamilyId) setShowFamilyDropdown(true);
                    }}
                    className="pl-10 h-12 text-base"
                  />
                  {selectedFamilyId && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedFamilyId("");
                        setFamilySearch("");
                        setSelectedType("");
                        setShowFamilyDropdown(true);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showFamilyDropdown && !selectedFamilyId && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredFamilies.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                          Aucune famille trouvée
                        </p>
                      ) : (
                        filteredFamilies.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-green-50 transition flex justify-between items-center border-b last:border-b-0"
                            onClick={() => {
                              setSelectedFamilyId(f.id);
                              setFamilySearch("");
                              setShowFamilyDropdown(false);
                            }}
                          >
                            <div>
                              <p className="font-medium">
                                {f.responsibleName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {f.neighborhood} — {f.memberCount} membres,{" "}
                                {f.childrenCount} enfant
                                {f.childrenCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <Badge
                              variant={
                                f.situation === "insured"
                                  ? "default"
                                  : "secondary"
                              }
                              className="shrink-0 ml-2"
                            >
                              {f.situation === "insured"
                                ? "Assuré"
                                : "Non assuré"}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Family Context — only when family selected */}
              {selectedFamily && (
                <div className="mb-6 space-y-4">
                  {/* Pending Needs */}
                  {pendingNeeds.length > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <p className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Besoins en attente ({pendingNeeds.length})
                        <span className="font-normal text-orange-600">
                          — cliquez pour enregistrer
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pendingNeeds.map((need) => (
                          <button
                            key={need.id}
                            type="button"
                            onClick={() => selectNeedAsType(need)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                              selectedType === need.type
                                ? "bg-green-100 border-green-400 text-green-800 ring-2 ring-green-300"
                                : "bg-white border-orange-200 text-orange-800 hover:bg-orange-100"
                            }`}
                          >
                            {selectedType === need.type && (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            {getCategoryLabel(need.type)}
                            {need.details && (
                              <span className="text-xs opacity-75">
                                ({need.details})
                              </span>
                            )}
                            <Badge
                              variant={
                                need.urgency === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {NEED_URGENCY_LABELS[need.urgency]}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Aids - Anti-redundancy */}
                  {recentFamilyAids.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Déjà donné récemment
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentFamilyAids.slice(0, 6).map((aid) => (
                          <span
                            key={aid.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs bg-blue-100 text-blue-700 border border-blue-200"
                          >
                            {getCategoryLabel(aid.type)} x{aid.quantity}
                            <span className="opacity-60">
                              (
                              {formatDistanceToNow(new Date(aid.date), {
                                addSuffix: false,
                                locale: fr,
                              })}
                              )
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingNeeds.length === 0 &&
                    recentFamilyAids.length === 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                        <p className="text-sm text-muted-foreground">
                          Aucun besoin en attente et aucune aide récente pour
                          cette famille.
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Step 2: Type + Quick options */}
              {selectedFamilyId && (
                <>
                  <div className="mb-4">
                    <Label className="text-base font-semibold mb-2 block">
                      2. Type d'aide
                      {pendingNeeds.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (ou sélectionnez un besoin ci-dessus)
                        </span>
                      )}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {categories.map((cat) => {
                        const val = cat.id;
                        const label = cat.name;
                        const isRedundant = recentlyGivenTypes.has(val);
                        const isSelected = selectedType === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              setSelectedType(val)
                            }
                            className={`relative px-3 py-3 rounded-lg text-sm font-medium border transition-all ${
                              isSelected
                                ? "bg-green-100 border-green-400 text-green-800 ring-2 ring-green-300"
                                : isRedundant
                                ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                                : "bg-white border-gray-200 text-foreground hover:bg-gray-50"
                            }`}
                          >
                            {label}
                            {isRedundant && !isSelected && (
                              <span className="block text-[10px] text-blue-500 mt-0.5">
                                Déjà donné
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Quantity + Source (compact row) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <Label className="text-sm">Quantité</Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(parseInt(e.target.value) || 1)
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Source</Label>

                      <Select
                        value={source}
                        onValueChange={(v) => setSource(v as AidSource)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AID_SOURCE_LABELS).map(
                            ([val, label]) => (
                              <SelectItem key={val} value={val}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-muted-foreground gap-1"
                      >
                        {showDetails ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {showDetails
                          ? "Masquer les détails"
                          : "Détails optionnels"}
                      </Button>
                    </div>
                  </div>

                  {/* Optional Details */}
                  {showDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-1">
                        <Label className="text-sm">Notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="Détails de l'aide..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">
                          Preuve (lien photo/document)
                        </Label>
                        <Input
                          type="url"
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={
                        !selectedType || createMutation.isPending
                      }
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 gap-2 h-12 px-8 text-base"
                    >
                      {createMutation.isPending ? (
                        "Enregistrement..."
                      ) : (
                        <>
                          <Gift className="w-5 h-5" />
                          Enregistrer l'aide
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetQuickAdd}
                      className="text-muted-foreground"
                    >
                      Réinitialiser
                    </Button>
                    {selectedType && recentlyGivenTypes.has(selectedType) && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Ce type d'aide a déjà été donné récemment à cette
                        famille
                      </p>
                    )}
                  </div>
                </>
              )}
            </form>
          </div>
        )}

        {/* ═══════════ STATS (admin) ═══════════ */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {categories
              .slice(0, 4)
              .map((cat) => {
                const type = cat.id;
                const label = cat.name;
                const count = aidsThisMonth.filter(
                  (a) => a.type === type
                ).length;
                return (
                  <div
                    key={type}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {count}
                    </p>
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
              <Input
                placeholder="Rechercher dans l'historique..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout type</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute source</SelectItem>
                    {Object.entries(AID_SOURCE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ AIDS LIST ═══════════ */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Gift className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Aucune aide trouvée
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((aid) => {
              const family = familyMap.get(aid.familyId);
              return (
                <div
                  key={aid.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Gift className="w-4 h-4 text-green-600" />
                        <span className="font-semibold">
                          {getCategoryLabel(aid.type)}
                        </span>
                        <Badge variant="secondary">x{aid.quantity}</Badge>
                        <Badge variant="outline">
                          {AID_SOURCE_LABELS[aid.source]}
                        </Badge>
                      </div>
                      {family && (
                        <Link
                          to={`/families/${family.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {family.responsibleName} — {family.neighborhood}
                        </Link>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Par {aid.volunteerName}
                      </p>
                      {aid.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {aid.notes}
                        </p>
                      )}
                      {aid.proofUrl && (
                        <a
                          href={aid.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          Voir la preuve
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(aid.date), "d MMM yyyy", {
                        locale: fr,
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        )}
      </div>
    </div>
  );
}
