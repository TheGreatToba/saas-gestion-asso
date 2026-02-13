import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowLeft,
  Calendar,
  User,
  Play,
  CheckCircle2,
  Pencil,
  Trash2,
  ListTodo,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  INTERVENTION_STATUS_LABELS,
  type Intervention,
  type InterventionStatus,
  type InterventionChecklistItem,
} from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ROUTES, interventionDetailRoute, familyDetailRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const statusBadgeClass: Record<InterventionStatus, string> = {
  todo: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  done: "bg-green-100 text-green-800 border-green-200",
};

function generateChecklistId(): string {
  return "ck-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function InterventionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editPlannedAt, setEditPlannedAt] = useState("");
  const [editAssignedUserId, setEditAssignedUserId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const canEdit = userRole === "admin" || userRole === "coordinator";

  const { data: intervention, isLoading, error } = useQuery({
    queryKey: ["intervention", id],
    queryFn: () => api.getIntervention(id!),
    enabled: !!id,
  });

  const { data: familiesData } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies({ limit: 500, offset: 0 }),
  });
  const families = familiesData?.items ?? [];
  const family = intervention
    ? families.find((f) => f.id === intervention.familyId)
    : null;

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ["users-assignable"],
    queryFn: () => api.getAssignableUsers(),
    enabled: canEdit && showEdit,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: "todo" | "in_progress" | "done") =>
      api.updateInterventionStatus(id!, status),
    onSuccess: (data) => {
      queryClient.setQueryData(["intervention", id], data);
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: (checklist: InterventionChecklistItem[]) =>
      api.updateInterventionChecklist(id!, checklist),
    onSuccess: (data) => {
      queryClient.setQueryData(["intervention", id], data);
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      plannedAt?: string;
      assignedUserId?: string;
      notes?: string;
    }) =>
      api.updateIntervention(id!, {
        plannedAt: payload.plannedAt,
        assignedUserId: payload.assignedUserId,
        notes: payload.notes,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["intervention", id], data);
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      setShowEdit(false);
      toast({ title: "Intervention mise à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteIntervention(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      setDeleteConfirm(false);
      navigate(ROUTES.planning);
      toast({ title: "Intervention supprimée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleToggleChecklistItem = (index: number) => {
    if (!intervention) return;
    const next = intervention.checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item,
    );
    updateChecklistMutation.mutate(next);
  };

  const handleAddChecklistItem = () => {
    if (!intervention) return;
    const next = [
      ...intervention.checklist,
      { id: generateChecklistId(), label: "Nouvelle tâche", done: false },
    ];
    updateChecklistMutation.mutate(next);
  };

  const handleEditOpen = () => {
    if (intervention) {
      setEditPlannedAt(intervention.plannedAt.slice(0, 16));
      setEditAssignedUserId(intervention.assignedUserId);
      setEditNotes(intervention.notes ?? "");
    }
    setShowEdit(true);
  };

  const handleEditSubmit = () => {
    updateMutation.mutate({
      plannedAt: editPlannedAt ? new Date(editPlannedAt).toISOString() : undefined,
      assignedUserId: editAssignedUserId || undefined,
      notes: editNotes,
    });
  };

  if (isLoading || !id) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container max-w-2xl mx-auto py-6 px-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </main>
      </div>
    );
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header />
        <main className="container max-w-2xl mx-auto py-6 px-4">
          <p className="text-destructive">Intervention introuvable.</p>
          <Button variant="link" asChild>
            <Link to={ROUTES.planning}>Retour au planning</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container max-w-2xl mx-auto py-6 px-4">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to={ROUTES.planning} className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Planning
          </Link>
        </Button>

        <div className="rounded-lg border bg-card p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge
              variant="outline"
              className={cn("text-sm", statusBadgeClass[intervention.status])}
            >
              {INTERVENTION_STATUS_LABELS[intervention.status]}
            </Badge>
            <div className="flex gap-2">
              {intervention.status === "todo" && (
                <Button
                  size="sm"
                  onClick={() => updateStatusMutation.mutate("in_progress")}
                  disabled={updateStatusMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Démarrer
                </Button>
              )}
              {intervention.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => updateStatusMutation.mutate("done")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Terminer
                </Button>
              )}
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditOpen}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Supprimer
                  </Button>
                </>
              )}
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Famille</Label>
            <p className="font-medium">
              {family ? (
                <Link
                  to={familyDetailRoute(family.id)}
                  className="text-primary hover:underline"
                >
                  {family.responsibleName} – {family.neighborhood}
                </Link>
              ) : (
                `Famille #${intervention.familyId.slice(0, 8)}`
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <Label className="text-muted-foreground">Assigné à</Label>
              <p className="flex items-center gap-1 font-medium">
                <User className="h-4 w-4" />
                {intervention.assignedUserName}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Date prévue</Label>
              <p className="flex items-center gap-1 font-medium">
                <Calendar className="h-4 w-4" />
                {format(new Date(intervention.plannedAt), "d MMMM yyyy à HH:mm", {
                  locale: fr,
                })}
              </p>
            </div>
          </div>

          {intervention.startedAt && (
            <div>
              <Label className="text-muted-foreground">Démarrée le</Label>
              <p className="text-sm">
                {format(new Date(intervention.startedAt), "d MMM yyyy à HH:mm", {
                  locale: fr,
                })}
              </p>
            </div>
          )}
          {intervention.completedAt && (
            <div>
              <Label className="text-muted-foreground">Terminée le</Label>
              <p className="text-sm">
                {format(new Date(intervention.completedAt), "d MMM yyyy à HH:mm", {
                  locale: fr,
                })}
              </p>
            </div>
          )}

          {intervention.notes && (
            <div>
              <Label className="text-muted-foreground">Notes</Label>
              <p className="text-sm whitespace-pre-wrap">{intervention.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                Checklist
              </Label>
              {(userRole === "admin" ||
                userRole === "coordinator" ||
                user?.id === intervention.assignedUserId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddChecklistItem}
                  disabled={updateChecklistMutation.isPending}
                >
                  Ajouter
                </Button>
              )}
            </div>
            {intervention.checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune tâche.</p>
            ) : (
              <ul className="space-y-2">
                {intervention.checklist.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded border p-2"
                  >
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => handleToggleChecklistItem(index)}
                      disabled={updateChecklistMutation.isPending}
                    />
                    <span
                      className={cn(
                        "text-sm flex-1",
                        item.done && "line-through text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier l'intervention</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Assigné à</Label>
                <Select
                  value={editAssignedUserId}
                  onValueChange={setEditAssignedUserId}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                  value={editPlannedAt}
                  onChange={(e) => setEditPlannedAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={updateMutation.isPending}
              >
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteConfirm}
          onOpenChange={setDeleteConfirm}
          title="Supprimer l'intervention"
          description="Cette action est irréversible."
          confirmLabel="Supprimer"
          variant="destructive"
          onConfirm={() => deleteMutation.mutate()}
        />
      </main>
    </div>
  );
}
