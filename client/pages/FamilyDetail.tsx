import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Phone,
  MapPin,
  Users,
  Baby,
  Plus,
  Gift,
  AlertTriangle,
  FileText,
  Trash2,
  Calendar,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import {
  FAMILY_HOUSING_LABELS,
  NEED_URGENCY_LABELS,
  NEED_STATUS_LABELS,
  PRIORITY_LABELS,
  AID_SOURCE_LABELS,
  CHILD_SEX_LABELS,
  FAMILY_DOCUMENT_TYPE_LABELS,
} from "@shared/schema";
import type {
  NeedUrgency,
  AidSource,
  ChildSex,
  NeedStatus,
  EnrichedNeed,
  FamilyDocumentType,
} from "@shared/schema";
import { statusBadgeClasses, urgencyBadgeClasses, priorityBadgeClasses } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function FamilyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { categories, getCategoryLabel } = useCategories();
  const queryClient = useQueryClient();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddNeed, setShowAddNeed] = useState(false);
  const [showAddAid, setShowAddAid] = useState(false);
  const [addAidPrefillType, setAddAidPrefillType] = useState<string>("");
  const [addAidPrefillNotes, setAddAidPrefillNotes] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);

  const { data: family, isLoading: familyLoading, error: familyError } = useQuery({
    queryKey: ["family", id],
    queryFn: () => api.getFamily(id!),
    enabled: !!id,
  });

  const { data: children = [], error: childrenError } = useQuery({
    queryKey: ["children", id],
    queryFn: () => api.getChildren(id!),
    enabled: !!id,
  });

  const { data: needs = [], error: needsError } = useQuery({
    queryKey: ["needs", id],
    queryFn: () => api.getNeedsByFamily(id!),
    enabled: !!id,
  });

  const { data: aids = [], error: aidsError } = useQuery({
    queryKey: ["aids", id],
    queryFn: () => api.getAidsByFamily(id!),
    enabled: !!id,
  });

  const { data: notes = [], error: notesError } = useQuery({
    queryKey: ["notes", id],
    queryFn: () => api.getNotes(id!),
    enabled: !!id,
  });

  const { data: documents = [], error: documentsError } = useQuery({
    queryKey: ["documents", id],
    queryFn: () => api.getFamilyDocuments(id!),
    enabled: !!id,
  });

  // ---- Mutations ----
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["children", id] });
    queryClient.invalidateQueries({ queryKey: ["needs", id] });
    queryClient.invalidateQueries({ queryKey: ["aids", id] });
    queryClient.invalidateQueries({ queryKey: ["notes", id] });
    queryClient.invalidateQueries({ queryKey: ["documents", id] });
    queryClient.invalidateQueries({ queryKey: ["family", id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const addChildMutation = useMutation({
    mutationFn: (data: { firstName: string; age: number; sex: ChildSex; specificNeeds: string }) =>
      api.createChild(id!, data),
    onSuccess: () => {
      invalidateAll();
      setShowAddChild(false);
      toast({ title: "Enfant ajouté" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: api.deleteChild,
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Enfant supprimé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const addNeedMutation = useMutation({
    mutationFn: api.createNeed,
    onSuccess: () => {
      invalidateAll();
      setShowAddNeed(false);
      toast({ title: "Besoin ajouté" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const updateNeedMutation = useMutation({
    mutationFn: ({ needId, status }: { needId: string; status: string }) =>
      api.updateNeed(needId, { status }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Statut mis à jour" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const addAidMutation = useMutation({
    mutationFn: api.createAid,
    onSuccess: () => {
      invalidateAll();
      setShowAddAid(false);
      toast({ title: "Aide enregistrée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { content: string; date: string }) =>
      api.createNote(id!, data),
    onSuccess: () => {
      invalidateAll();
      setShowAddNote(false);
      toast({ title: "Note ajoutée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: (data: { name: string; documentType: FamilyDocumentType; fileData: string; mimeType: string }) =>
      api.createFamilyDocument(id!, data),
    onSuccess: () => {
      invalidateAll();
      setShowAddDocument(false);
      toast({ title: "Document ajouté" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteFamilyDocument(id!, documentId),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Document supprimé" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (familyLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground text-lg">Famille non trouvée</p>
          <Link to="/families">
            <Button className="mt-4">Retour aux familles</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build timeline from all events
  const timeline = [
    ...aids.map((a) => ({
      type: "aid" as const,
      date: a.date,
      title: `Aide : ${getCategoryLabel(a.type)} (x${a.quantity})`,
      subtitle: `Par ${a.volunteerName} — ${AID_SOURCE_LABELS[a.source]}`,
      notes: a.notes,
    })),
    ...needs.map((n) => ({
      type: "need" as const,
      date: n.createdAt,
      title: `Besoin : ${getCategoryLabel(n.type)}`,
      subtitle: `${NEED_STATUS_LABELS[n.status]} — Priorité : ${(n as EnrichedNeed).priorityLevel ? PRIORITY_LABELS[(n as EnrichedNeed).priorityLevel] : NEED_URGENCY_LABELS[n.urgency]}`,
      notes: n.comment,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      date: n.date,
      title: `Visite de ${n.volunteerName}`,
      subtitle: "",
      notes: n.content,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const phoneHref = family.phone.replace(/\s+/g, "");
  const mapQuery = encodeURIComponent(`${family.address}, ${family.neighborhood}`);
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(familyError || childrenError || needsError || aidsError || notesError || documentsError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-6">
            Certaines données n'ont pas pu être chargées. Réessayez.
          </div>
        )}
        {/* Back + Header */}
        <Link
          to="/families"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux familles
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {family.responsibleName}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    family.housing === "housed"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : family.housing === "pending_placement"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-red-100 text-red-800 border-red-300"
                  }
                >
                  {FAMILY_HOUSING_LABELS[family.housing]}
                  {family.housingName && ` — ${family.housingName}`}
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
                  {family.address}, {family.neighborhood}
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
              <div className="flex flex-wrap gap-2 mt-4">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a href={`tel:${phoneHref}`} aria-label="Appeler la famille">
                    <Phone className="w-4 h-4" />
                    Appeler
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a href={mapHref} target="_blank" rel="noopener noreferrer">
                    <MapPin className="w-4 h-4" />
                    Itinéraire
                  </a>
                </Button>
              </div>
              {(family.notes || family.healthNotes) && (
                <div className="mt-3 space-y-2">
                  {family.healthNotes && (
                    <p className="text-sm text-red-800 bg-red-50 p-3 rounded border border-red-200">
                      {family.healthNotes}
                    </p>
                  )}
                  {family.notes && (
                    <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                      {family.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700 w-full"
            onClick={() => setShowAddAid(true)}
          >
            <Gift className="w-4 h-4" />
            Enregistrer une aide
          </Button>
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => setShowAddNeed(true)}
          >
            <AlertTriangle className="w-4 h-4" />
            Ajouter un besoin
          </Button>
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => setShowAddNote(true)}
          >
            <FileText className="w-4 h-4" />
            Ajouter une note
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full max-w-3xl">
            <TabsTrigger value="timeline">Historique</TabsTrigger>
            <TabsTrigger value="children">
              Enfants ({children.length})
            </TabsTrigger>
            <TabsTrigger value="needs">
              Besoins ({needs.filter((n) => n.status !== "covered").length})
            </TabsTrigger>
            <TabsTrigger value="aids">Aides ({aids.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-6">
                Historique complet
              </h2>
              {timeline.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun événement enregistré
                </p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {timeline.map((event, idx) => (
                      <div key={idx} className="relative pl-10">
                        <div
                          className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${
                            event.type === "aid"
                              ? "bg-green-500"
                              : event.type === "need"
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-medium text-sm">
                              {event.title}
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                              {format(new Date(event.date), "d MMM yyyy", {
                                locale: fr,
                              })}
                            </span>
                          </div>
                          {event.subtitle && (
                            <p className="text-xs text-muted-foreground">
                              {event.subtitle}
                            </p>
                          )}
                          {event.notes && (
                            <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Children Tab */}
          <TabsContent value="children">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Enfants</h2>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAddChild(true)}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </div>
              {children.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun enfant enregistré
                </p>
              ) : (
                <div className="grid gap-3">
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {child.firstName}{" "}
                          <span className="text-muted-foreground text-sm">
                            — {child.age} an{child.age !== 1 ? "s" : ""},{" "}
                            {CHILD_SEX_LABELS[child.sex]}
                          </span>
                        </p>
                        {child.specificNeeds && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Besoins : {child.specificNeeds}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            if (confirm("Supprimer cet enfant ?")) {
                              deleteChildMutation.mutate(child.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Needs Tab */}
          <TabsContent value="needs">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Besoins</h2>
                <Link to={`/needs?action=add&familyId=${id}`}>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </Button>
                </Link>
              </div>
              {needs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun besoin enregistré
                </p>
              ) : (
                <div className="grid gap-3">
                  {needs.map((need) => (
                    <div
                      key={need.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {getCategoryLabel(need.type)}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusBadgeClasses(need.status)}`}
                          >
                            {NEED_STATUS_LABELS[need.status]}
                          </Badge>
                          {(need as EnrichedNeed).priorityLevel && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${priorityBadgeClasses((need as EnrichedNeed).priorityLevel)}`}
                            >
                              {PRIORITY_LABELS[(need as EnrichedNeed).priorityLevel]}
                            </Badge>
                          )}
                        </div>
                        {need.details && (
                          <p className="text-sm text-muted-foreground">
                            {need.details}
                          </p>
                        )}
                        {need.comment && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {need.comment}
                          </p>
                        )}
                      </div>
                      <Select
                        value={need.status}
                        onValueChange={(v) =>
                          updateNeedMutation.mutate({
                            needId: need.id,
                            status: v,
                          })
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Aids Tab */}
          <TabsContent value="aids">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Aides apportées</h2>
                <Link to={`/aids?action=add&familyId=${id}`}>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Enregistrer
                  </Button>
                </Link>
              </div>
              {aids.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune aide enregistrée
                </p>
              ) : (
                <div className="grid gap-3">
                  {aids.map((aid) => (
                    <div
                      key={aid.id}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-green-600" />
                          <p className="font-medium">
                            {getCategoryLabel(aid.type)} (x{aid.quantity})
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(aid.date), "d MMM yyyy", {
                            locale: fr,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {aid.volunteerName} — {AID_SOURCE_LABELS[aid.source]}
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
                          📎 Voir la preuve
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Notes de visite</h2>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAddNote(true)}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </div>
              {notes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune note enregistrée
                </p>
              ) : (
                <div className="grid gap-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-sm">
                          {note.volunteerName}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.date), "d MMM yyyy", {
                            locale: fr,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {note.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Documents (pièces d'identité, ordonnances…)</h2>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAddDocument(true)}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </Button>
              </div>
                  {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun document enregistré
                </p>
                  ) : (
                <div className="grid gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {FAMILY_DOCUMENT_TYPE_LABELS[doc.documentType]} — {doc.uploadedByName} — {format(new Date(doc.uploadedAt), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        {doc.downloadUrl ? (
                          <a
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline shrink-0"
                          >
                            Voir
                          </a>
                        ) : (
                          <Button
                            variant="link"
                            className="text-sm text-primary px-0 shrink-0"
                            onClick={async () => {
                              if (!id) return;
                              try {
                                const { url } = await api.getFamilyDocumentDownloadUrl(
                                  id,
                                  doc.id,
                                );
                                window.open(url, "_blank", "noopener,noreferrer");
                              } catch (err) {
                                console.error(err);
                                toast({
                                  title: "Erreur",
                                  description:
                                    "Impossible de générer le lien de téléchargement du document.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Voir
                          </Button>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 shrink-0"
                          onClick={() => {
                            if (confirm("Supprimer ce document ?")) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Child Dialog */}
      <Dialog open={showAddChild} onOpenChange={setShowAddChild}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un enfant</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addChildMutation.mutate({
                firstName: fd.get("firstName") as string,
                age: parseInt(fd.get("age") as string) || 0,
                sex: fd.get("sex") as ChildSex,
                specificNeeds: fd.get("specificNeeds") as string,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input name="firstName" required placeholder="Prénom de l'enfant" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Âge</Label>
                <Input name="age" type="number" min={0} defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label>Sexe</Label>
                <select
                  name="sex"
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                  defaultValue="male"
                >
                  <option value="male">Garçon</option>
                  <option value="female">Fille</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Besoins spécifiques</Label>
              <Input
                name="specificNeeds"
                placeholder="Couches, handicap, suivi médical..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddChild(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={addChildMutation.isPending}>
                Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Need Dialog */}
      <Dialog open={showAddNeed} onOpenChange={setShowAddNeed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un besoin</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addNeedMutation.mutate({
                familyId: id!,
                type: fd.get("type") as string,
                urgency: fd.get("urgency") as NeedUrgency,
                details: fd.get("details") as string,
                comment: fd.get("comment") as string,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <select
                  name="type"
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
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
              <Input name="details" placeholder="Ex: Taille 4, taille 9 ans..." />
            </div>
            <div className="space-y-2">
              <Label>Commentaire</Label>
              <Textarea name="comment" rows={2} placeholder="Contexte..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddNeed(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={addNeedMutation.isPending}>
                Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Aid Dialog — with pending needs context */}
      <Dialog
        open={showAddAid}
        onOpenChange={(open) => {
          setShowAddAid(open);
          if (!open) {
            setAddAidPrefillType("");
            setAddAidPrefillNotes("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" />
              Enregistrer une aide
            </DialogTitle>
          </DialogHeader>

          {/* Pending needs as clickable chips */}
          {(() => {
            const pendingNeeds = needs.filter((n) => n.status !== "covered");
            if (pendingNeeds.length === 0) return null;
            return (
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <p className="text-xs font-semibold text-orange-800 mb-2">
                  Besoins en attente — cliquez pour pré-remplir le type :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pendingNeeds.map((need) => (
                    <button
                      key={need.id}
                      type="button"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white border border-orange-200 text-orange-800 hover:bg-orange-100 transition"
                      onClick={() => {
                        setAddAidPrefillType(need.type);
                        setAddAidPrefillNotes(need.details ?? "");
                      }}
                    >
                      {getCategoryLabel(need.type)}
                      {need.details && <span className="opacity-70">({need.details})</span>}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${statusBadgeClasses(need.status)}`}
                      >
                        {NEED_STATUS_LABELS[need.status]}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Recent aids — anti-redundancy */}
          {aids.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-800 mb-2">
                Déjà donné récemment :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {aids.slice(0, 5).map((aid) => (
                  <span
                    key={aid.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-700"
                  >
                    {getCategoryLabel(aid.type)} x{aid.quantity}
                    <span className="opacity-60">
                      ({format(new Date(aid.date), "d MMM", { locale: fr })})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addAidMutation.mutate({
                familyId: id!,
                type: fd.get("aidType") as string,
                quantity: parseInt(fd.get("quantity") as string) || 1,
                date: new Date().toISOString(),
                source: fd.get("source") as AidSource,
                notes: fd.get("aidNotes") as string,
                proofUrl: fd.get("proofUrl") as string,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <select
                  name="aidType"
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                  value={addAidPrefillType || categories[0]?.id ?? ""}
                  onChange={(e) => setAddAidPrefillType(e.target.value)}
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
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
              <Label>Notes</Label>
              <Textarea
                name="aidNotes"
                rows={2}
                placeholder="Détails de l'aide..."
                value={addAidPrefillNotes}
                onChange={(e) => setAddAidPrefillNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Preuve (lien photo ou document)</Label>
              <Input name="proofUrl" type="url" placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddAid(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={addAidMutation.isPending}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                <Gift className="w-4 h-4" />
                {addAidMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note de visite</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addNoteMutation.mutate({
                content: fd.get("content") as string,
                date: fd.get("date") as string,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Date de visite *</Label>
              <Input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Contenu de la note *</Label>
              <Textarea
                name="content"
                rows={4}
                placeholder="Observations, état de la famille, actions à prévoir..."
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddNote(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={addNoteMutation.isPending}>
                Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={showAddDocument} onOpenChange={setShowAddDocument}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = (form.elements.namedItem("docName") as HTMLInputElement).value;
              const documentType = (form.elements.namedItem("docType") as HTMLSelectElement).value as FamilyDocumentType;
              const fileInput = form.elements.namedItem("docFile") as HTMLInputElement;
              const file = fileInput?.files?.[0];
              if (!file || !name) return;
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const mimeMatch = result.match(/^data:([^;]+)/);
                const mimeType = mimeMatch ? mimeMatch[1] : file.type || "application/octet-stream";
                addDocumentMutation.mutate({
                  name: name.trim(),
                  documentType,
                  fileData: result,
                  mimeType,
                });
              };
              reader.readAsDataURL(file);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nom du document *</Label>
              <Input name="docName" placeholder="Ex: CIN, ordonnance Dr. X..." required />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <select
                name="docType"
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                required
                defaultValue="other"
              >
                {(Object.entries(FAMILY_DOCUMENT_TYPE_LABELS) as [FamilyDocumentType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fichier (image ou PDF) *</Label>
              <Input name="docFile" type="file" accept="image/*,.pdf" required />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowAddDocument(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={addDocumentMutation.isPending}>
                {addDocumentMutation.isPending ? "Envoi..." : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
