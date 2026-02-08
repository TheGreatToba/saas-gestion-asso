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
import { Plus, Search, Gift, Calendar } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  NEED_TYPE_LABELS,
  AID_SOURCE_LABELS,
} from "@shared/schema";
import type { NeedType, AidSource } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Aids() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(searchParams.get("action") === "add");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: aids = [], isLoading } = useQuery({
    queryKey: ["aids-all"],
    queryFn: api.getAids,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies(),
  });

  const { isAdmin } = useAuth();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
    enabled: isAdmin, // Only admins can list users
  });

  const familyMap = new Map(families.map((f) => [f.id, f]));

  const createMutation = useMutation({
    mutationFn: api.createAid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aids-all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowForm(false);
      toast({ title: "Aide enregistrée avec succès !" });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Filter aids
  const filtered = aids.filter((aid) => {
    if (filterType !== "all" && aid.type !== filterType) return false;
    if (filterSource !== "all" && aid.source !== filterSource) return false;
    if (search) {
      const family = familyMap.get(aid.familyId);
      const searchLower = search.toLowerCase();
      if (
        !family?.responsibleName.toLowerCase().includes(searchLower) &&
        !family?.neighborhood.toLowerCase().includes(searchLower) &&
        !aid.volunteerName.toLowerCase().includes(searchLower) &&
        !NEED_TYPE_LABELS[aid.type].toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    return true;
  });

  // Calculate stats
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Aides</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? (
                <>
                  {aids.length} aide{aids.length !== 1 ? "s" : ""} enregistrée
                  {aids.length !== 1 ? "s" : ""}
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
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Enregistrer une aide
          </Button>
        </div>

        {/* Stats cards — admin only */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {Object.entries(NEED_TYPE_LABELS)
              .slice(0, 4)
              .map(([type, label]) => {
                const count = aidsThisMonth.filter(
                  (a) => a.type === type
                ).length;
                return (
                  <div
                    key={type}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">ce mois</p>
                  </div>
                );
              })}
          </div>
        )}

        {/* Search + Filters — full for admin, simple for volunteer */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par famille..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                    {Object.entries(NEED_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
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
                <div
                  key={aid.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Gift className="w-4 h-4 text-green-600" />
                        <span className="font-semibold">
                          {NEED_TYPE_LABELS[aid.type]}
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
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(aid.date), "d MMM yyyy", { locale: fr })}
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
              <DialogTitle>Enregistrer une aide</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({
                  familyId: fd.get("familyId") as string,
                  type: fd.get("type") as NeedType,
                  quantity: parseInt(fd.get("quantity") as string) || 1,
                  date: new Date(fd.get("date") as string).toISOString(),
                  volunteerId: user?.id || "",
                  volunteerName: user?.name || "",
                  source: fd.get("source") as AidSource,
                  notes: fd.get("notes") as string,
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
                  <Label>Type d'aide *</Label>
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
                  <Label>Source *</Label>
                  <select
                    name="source"
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                    required
                  >
                    {Object.entries(AID_SOURCE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantité *</Label>
                  <Input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  name="notes"
                  rows={2}
                  placeholder="Détails de l'aide..."
                />
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
                  {createMutation.isPending
                    ? "Enregistrement..."
                    : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
