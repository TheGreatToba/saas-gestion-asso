import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Calendar, Plus, ListTodo, User, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { INTERVENTION_STATUS_LABELS } from "@shared/schema";
import type { Intervention, InterventionStatus } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ROUTES, interventionDetailRoute, familyDetailRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

const statusBadgeClass: Record<InterventionStatus, string> = {
  todo: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-green-100 text-green-800 border-green-200",
};

export default function Planning() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"all" | "mine">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createFamilyId, setCreateFamilyId] = useState("");
  const [createAssignedUserId, setCreateAssignedUserId] = useState("");
  const [createPlannedAt, setCreatePlannedAt] = useState("");
  const [createNotes, setCreateNotes] = useState("");

  const canCreate = userRole === "admin" || userRole === "coordinator";

  const { data: interventionsData, isLoading } = useQuery({
    queryKey: ["interventions", view, filterStatus],
    queryFn: async () => {
      if (view === "mine") {
        return api.getMyInterventions(
          filterStatus !== "all" ? { status: filterStatus } : undefined,
        );
      }
      const res = await api.getInterventions({
        limit: 200,
        offset: 0,
        ...(filterStatus !== "all" ? { status: filterStatus } : {}),
      });
      return res.items;
    },
  });

  const interventions = Array.isArray(interventionsData)
    ? interventionsData
    : (interventionsData as { items?: Intervention[] })?.items ?? [];

  const { data: familiesData } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies({ limit: 500, offset: 0 }),
  });
  const families = familiesData?.items ?? [];

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ["users-assignable"],
    queryFn: () => api.getAssignableUsers(),
    enabled: canCreate && showCreate,
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      familyId: string;
      assignedUserId: string;
      plannedAt: string;
      notes?: string;
    }) =>
      api.createIntervention({
        familyId: payload.familyId,
        assignedUserId: payload.assignedUserId,
        plannedAt: payload.plannedAt,
        notes: payload.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      setShowCreate(false);
      setCreateFamilyId("");
      setCreateAssignedUserId("");
      setCreatePlannedAt("");
      setCreateNotes("");
      toast({ title: "Intervention créée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!createFamilyId || !createAssignedUserId || !createPlannedAt) {
      toast({
        title: "Champs requis",
        description: "Famille, bénévole assigné et date prévue sont requis.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      familyId: createFamilyId,
      assignedUserId: createAssignedUserId,
      plannedAt: new Date(createPlannedAt).toISOString(),
      notes: createNotes || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container max-w-4xl mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Planning des interventions
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Missions assignées aux bénévoles
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle intervention
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={view === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("all")}
          >
            Toutes
          </Button>
          <Button
            variant={view === "mine" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("mine")}
          >
            <User className="h-3 w-3 mr-1" />
            Mes interventions
          </Button>
          <Select
            value={filterStatus}
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(["todo", "in_progress", "done"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {INTERVENTION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : interventions.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>
              {view === "mine"
                ? "Aucune intervention ne vous est assignée."
                : "Aucune intervention pour le moment."}
            </p>
            {canCreate && view === "all" && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreate(true)}
              >
                Créer une intervention
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {interventions.map((int) => (
              <li key={int.id}>
                <Link
                  to={interventionDetailRoute(int.id)}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4",
                    "hover:bg-muted/50 transition-colors",
                  )}
                >
                  <Badge
                    variant="outline"
                    className={statusBadgeClass[int.status]}
                  >
                    {INTERVENTION_STATUS_LABELS[int.status]}
                  </Badge>
                  <span className="font-medium">
                    {families.find((f) => f.id === int.familyId)?.responsibleName ??
                      `Famille #${int.familyId.slice(0, 8)}`}
                  </span>
                  <span className="text-muted-foreground text-sm flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {int.assignedUserName}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {format(new Date(int.plannedAt), "d MMM yyyy à HH:mm", {
                      locale: fr,
                    })}
                  </span>
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle intervention</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Famille</Label>
                <Select
                  value={createFamilyId}
                  onValueChange={setCreateFamilyId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une famille" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.responsibleName} – {f.neighborhood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigné à</Label>
                <Select
                  value={createAssignedUserId}
                  onValueChange={setCreateAssignedUserId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un bénévole" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date prévue</Label>
                <Input
                  type="datetime-local"
                  value={createPlannedAt}
                  onChange={(e) => setCreatePlannedAt(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes (optionnel)</Label>
                <Textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !createFamilyId ||
                  !createAssignedUserId ||
                  !createPlannedAt ||
                  createMutation.isPending
                }
              >
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
