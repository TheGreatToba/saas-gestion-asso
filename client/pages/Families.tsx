import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Users,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  Baby,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FAMILY_HOUSING_LABELS } from "@shared/schema";
import type { CreateFamilyInput, Family, FamilyHousing } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const emptyForm: CreateFamilyInput = {
  responsibleName: "",
  phone: "",
  address: "",
  neighborhood: "",
  memberCount: 1,
  childrenCount: 0,
  housing: "not_housed",
  healthNotes: "",
  hasMedicalNeeds: false,
  notes: "",
};

export default function Families() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(searchParams.get("action") === "add");
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [form, setForm] = useState<CreateFamilyInput>(emptyForm);

  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families", search],
    queryFn: () => api.getFamilies(search || undefined),
  });

  const medicalFilter = searchParams.get("medical") === "1";
  const visibleFamilies = medicalFilter
    ? families.filter((f) => f.hasMedicalNeeds)
    : families;

  const createMutation = useMutation({
    mutationFn: api.createFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setShowForm(false);
      setForm(emptyForm);
      toast({ title: "Famille ajoutée avec succès" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFamilyInput> }) =>
      api.updateFamily(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      setEditingFamily(null);
      setForm(emptyForm);
      toast({ title: "Famille mise à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({ title: "Famille supprimée" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFamily) {
      updateMutation.mutate({ id: editingFamily.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (family: Family) => {
    setEditingFamily(family);
    setForm({
      responsibleName: family.responsibleName,
      phone: family.phone,
      address: family.address,
      neighborhood: family.neighborhood,
      memberCount: family.memberCount,
      childrenCount: family.childrenCount,
      housing: family.housing,
      healthNotes: family.healthNotes || "",
      hasMedicalNeeds: family.hasMedicalNeeds || false,
      notes: family.notes || "",
    });
  };

  const closeDialog = () => {
    setShowForm(false);
    setEditingFamily(null);
    setForm(emptyForm);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Familles</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? `${visibleFamilies.length} famille${visibleFamilies.length !== 1 ? "s" : ""} enregistrée${visibleFamilies.length !== 1 ? "s" : ""}`
                : "Consultez et mettez à jour les informations des familles"}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle famille
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, quartier, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {medicalFilter && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-6">
            Filtre actif : familles avec besoins médicaux.
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : visibleFamilies.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              {search ? "Aucune famille trouvée" : "Aucune famille enregistrée"}
            </p>
            {!search && (
              <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Ajouter la première famille
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleFamilies.map((family) => (
              <div
                key={family.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        to={`/families/${family.id}`}
                        className="text-lg font-semibold text-foreground hover:text-primary transition truncate"
                      >
                        {family.responsibleName}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${
                          family.housing === "housed"
                            ? "bg-green-100 text-green-800 border-green-300"
                            : family.housing === "pending_placement"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-red-100 text-red-800 border-red-300"
                        }`}
                      >
                        {FAMILY_HOUSING_LABELS[family.housing]}
                      </Badge>
                      {family.hasMedicalNeeds && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Médical
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {family.phone}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {family.neighborhood}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {family.memberCount} membres
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Baby className="w-3.5 h-3.5" />
                        {family.childrenCount} enfant
                        {family.childrenCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {family.lastVisitAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Dernière visite :{" "}
                        {formatDistanceToNow(new Date(family.lastVisitAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/families/${family.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {isAdmin ? "Voir" : "Ouvrir"}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openEdit(family)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      {!isAdmin && "Modifier"}
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Supprimer cette famille et toutes ses données ?")) {
                            deleteMutation.mutate(family.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showForm || !!editingFamily} onOpenChange={closeDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFamily ? "Modifier la famille" : "Nouvelle famille"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du responsable *</Label>
                <Input
                  value={form.responsibleName}
                  onChange={(e) =>
                    setForm({ ...form, responsibleName: e.target.value })
                  }
                  placeholder="Nom complet"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="06 XX XX XX XX"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quartier *</Label>
                  <Input
                    value={form.neighborhood}
                    onChange={(e) =>
                      setForm({ ...form, neighborhood: e.target.value })
                    }
                    placeholder="Nom du quartier"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse *</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Adresse complète"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Membres</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.memberCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        memberCount: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enfants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.childrenCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        childrenCount: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hébergement (foyer)</Label>
                  <Select
                    value={form.housing}
                    onValueChange={(v: FamilyHousing) =>
                      setForm({ ...form, housing: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="housed">Hébergé en foyer</SelectItem>
                      <SelectItem value="pending_placement">En attente de placement</SelectItem>
                      <SelectItem value="not_housed">Sans hébergement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes sur la famille..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Maladies et spécificités</Label>
                <Textarea
                  value={form.healthNotes}
                  onChange={(e) => setForm({ ...form, healthNotes: e.target.value })}
                  placeholder="Ex: Handicapée besoin de dialyse, enfant autiste..."
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasMedicalNeeds}
                  onChange={(e) =>
                    setForm({ ...form, hasMedicalNeeds: e.target.checked })
                  }
                />
                Cas médical à suivre en priorité
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Enregistrement..."
                    : editingFamily
                    ? "Mettre à jour"
                    : "Ajouter"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
