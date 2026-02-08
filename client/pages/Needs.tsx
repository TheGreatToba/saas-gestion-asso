import { useState } from "react";
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
  Plus,
  Search,
  AlertTriangle,
  Filter,
  Trash2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  NEED_TYPE_LABELS,
  NEED_URGENCY_LABELS,
  NEED_STATUS_LABELS,
} from "@shared/schema";
import type { NeedType, NeedUrgency, NeedStatus, Need, Family } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Needs() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(searchParams.get("action") === "add");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: needs = [], isLoading } = useQuery({
    queryKey: ["needs-all"],
    queryFn: api.getNeeds,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies(),
  });

  const familyMap = new Map(families.map((f) => [f.id, f]));

  // Extract unique neighborhoods for filter
  const neighborhoods = [...new Set(families.map((f) => f.neighborhood))].sort();

  const createMutation = useMutation({
    mutationFn: api.createNeed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["needs-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowForm(false);
      toast({ title: "Besoin ajouté" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateNeed(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["needs-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteNeed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["needs-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Besoin supprimé" });
    },
  });

  // Filter needs
  const filtered = needs.filter((need) => {
    if (filterUrgency !== "all" && need.urgency !== filterUrgency) return false;
    if (filterType !== "all" && need.type !== filterType) return false;
    if (filterStatus !== "all" && need.status !== filterStatus) return false;
    if (filterNeighborhood !== "all") {
      const family = familyMap.get(need.familyId);
      if (family?.neighborhood !== filterNeighborhood) return false;
    }
    if (search) {
      const family = familyMap.get(need.familyId);
      const searchLower = search.toLowerCase();
      if (
        !family?.responsibleName.toLowerCase().includes(searchLower) &&
        !family?.neighborhood.toLowerCase().includes(searchLower) &&
        !NEED_TYPE_LABELS[need.type].toLowerCase().includes(searchLower) &&
        !(need.comment || "").toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    return true;
  });

  // Sort: high urgency first, then pending, then by date
  const sorted = [...filtered].sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { pending: 0, partial: 1, covered: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const urgentCount = needs.filter(
    (n) => n.urgency === "high" && n.status !== "covered"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Besoins</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? (
                <>
                  {needs.length} besoin{needs.length !== 1 ? "s" : ""} enregistré
                  {needs.length !== 1 ? "s" : ""}
                  {urgentCount > 0 && (
                    <span className="text-red-600 font-medium ml-2">
                      — {urgentCount} urgent{urgentCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </>
              ) : (
                "Signalez et mettez à jour les besoins des familles"
              )}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {isAdmin ? "Nouveau besoin" : "Signaler un besoin"}
          </Button>
        </div>

        {/* Alert banner for urgent needs */}
        {urgentCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800">
              <strong>{urgentCount} besoin{urgentCount !== 1 ? "s" : ""} urgent
              {urgentCount !== 1 ? "s" : ""}</strong>{" "}
              nécessite{urgentCount !== 1 ? "nt" : ""} une attention immédiate.
            </p>
          </div>
        )}

        {/* Search + Filters — full filters for admin, simple search for volunteer */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {isAdmin ? (
              <div className="flex gap-2 flex-wrap">
                <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Urgence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute urgence</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout type</SelectItem>
                    {Object.entries(NEED_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout statut</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="partial">Partiellement couvert</SelectItem>
                    <SelectItem value="covered">Couvert</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterNeighborhood} onValueChange={setFilterNeighborhood}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Quartier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout quartier</SelectItem>
                    {neighborhoods.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Urgence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute urgence</SelectItem>
                  <SelectItem value="high">Urgent</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="low">Faible</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* List */}
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
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">Aucun besoin trouvé</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sorted.map((need) => {
              const family = familyMap.get(need.familyId);
              return (
                <div
                  key={need.id}
                  className={`bg-white rounded-lg border shadow-sm p-5 ${
                    need.urgency === "high" && need.status !== "covered"
                      ? "border-l-4 border-l-red-500"
                      : need.urgency === "medium" && need.status !== "covered"
                      ? "border-l-4 border-l-yellow-500"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold">
                          {NEED_TYPE_LABELS[need.type]}
                        </span>
                        <Badge
                          variant={
                            need.urgency === "high"
                              ? "destructive"
                              : need.urgency === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {NEED_URGENCY_LABELS[need.urgency]}
                        </Badge>
                        <Badge
                          variant={
                            need.status === "covered"
                              ? "default"
                              : need.status === "partial"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {NEED_STATUS_LABELS[need.status]}
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
                      {need.details && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {need.details}
                        </p>
                      )}
                      {need.comment && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {need.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Créé{" "}
                        {formatDistanceToNow(new Date(need.createdAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={need.status}
                        onValueChange={(v) =>
                          updateMutation.mutate({ id: need.id, status: v })
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="partial">
                            Partiellement couvert
                          </SelectItem>
                          <SelectItem value="covered">Couvert</SelectItem>
                        </SelectContent>
                      </Select>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            if (confirm("Supprimer ce besoin ?")) {
                              deleteMutation.mutate(need.id);
                            }
                          }}
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

        {/* Create Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau besoin</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({
                  familyId: fd.get("familyId") as string,
                  type: fd.get("type") as NeedType,
                  urgency: fd.get("urgency") as NeedUrgency,
                  details: fd.get("details") as string,
                  comment: fd.get("comment") as string,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Famille *</Label>
                <select
                  name="familyId"
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                  required
                >
                  <option value="">Sélectionner une famille</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.responsibleName} — {f.neighborhood}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <select
                    name="type"
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                    required
                  >
                    {Object.entries(NEED_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Urgence *</Label>
                  <select
                    name="urgency"
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                    required
                  >
                    {Object.entries(NEED_URGENCY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Détails</Label>
                <Input
                  name="details"
                  placeholder="Ex: Taille 4, taille 9 ans..."
                />
              </div>
              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Textarea name="comment" rows={2} placeholder="Contexte..." />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Enregistrement..." : "Ajouter"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
