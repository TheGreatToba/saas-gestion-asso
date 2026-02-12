import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
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
import { Search, Gift, FileText, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";
import { AID_SOURCE_LABELS } from "@shared/schema";
import type { Family, Category, AidSource } from "@shared/schema";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ROUTES, familyDetailRoute } from "@/lib/routes";

const SEARCH_DEBOUNCE_MS = 300;

export default function Intervention() {
  const queryClient = useQueryClient();
  const { categories, getCategoryLabel } = useCategories();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [showAidDialog, setShowAidDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: searchResult, isLoading: searchLoading } = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () => api.searchGlobal(debouncedQ),
    enabled: debouncedQ.length >= 2,
  });

  const families = searchResult?.families ?? [];

  const createAidMutation = useMutation({
    mutationFn: api.createAid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search", debouncedQ] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (selectedFamily) {
        queryClient.invalidateQueries({ queryKey: ["aids", selectedFamily.id] });
      }
      setShowAidDialog(false);
      toast({ title: "Aide enregistrée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: ({ familyId, content, date }: { familyId: string; content: string; date: string }) =>
      api.createNote(familyId, { content, date }),
    onSuccess: (_, { familyId }) => {
      queryClient.invalidateQueries({ queryKey: ["notes", familyId] });
      setShowNoteDialog(false);
      toast({ title: "Note ajoutée" });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Intervention rapide</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Recherchez une famille puis enregistrez une aide ou une note.
        </p>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Nom, téléphone, adresse..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 h-12 text-base"
            aria-label="Rechercher une famille"
          />
        </div>

        {/* Results */}
        {debouncedQ.length >= 2 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
            {searchLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Recherche en cours...
              </div>
            ) : families.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Aucune famille trouvée.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
                {families.map((f) => (
                  <li key={f.id}>
                    <div className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
                      <Link
                        to={familyDetailRoute(f.id)}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-medium text-foreground truncate">
                          {f.number > 0 ? `Famille N° ${f.number}` : "Famille"} — {f.responsibleName || "—"}
                        </p>
                        {f.address && (
                          <p className="text-sm text-muted-foreground truncate">{f.address}</p>
                        )}
                      </Link>
                      <Button
                        size="sm"
                        variant={selectedFamily?.id === f.id ? "default" : "outline"}
                        onClick={() => setSelectedFamily(selectedFamily?.id === f.id ? null : f)}
                      >
                        {selectedFamily?.id === f.id ? "Sélectionnée" : "Sélectionner"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Quick actions (when family selected) */}
        {selectedFamily && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Famille N° {selectedFamily.number} — {selectedFamily.responsibleName || "—"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-auto py-6 flex flex-col gap-2"
                onClick={() => setShowAidDialog(true)}
              >
                <Gift className="w-8 h-8" />
                <span>Enregistrer une aide</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-auto py-6 flex flex-col gap-2"
                onClick={() => setShowNoteDialog(true)}
              >
                <FileText className="w-8 h-8" />
                <span>Ajouter une note</span>
              </Button>
            </div>
            <Link to={familyDetailRoute(selectedFamily.id)} className="block">
              <Button variant="ghost" size="sm" className="w-full gap-2">
                <Users className="w-4 h-4" />
                Voir la fiche famille
              </Button>
            </Link>
          </div>
        )}

        {!selectedFamily && debouncedQ.length < 2 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-muted-foreground text-sm">
            Saisissez au moins 2 caractères pour rechercher une famille.
          </div>
        )}
      </div>

      {/* Aid dialog */}
      <AidDialog
        open={showAidDialog}
        onOpenChange={setShowAidDialog}
        family={selectedFamily}
        categories={categories}
        getCategoryLabel={getCategoryLabel}
        isPending={createAidMutation.isPending}
        onSubmit={(data) => createAidMutation.mutate(data)}
      />

      {/* Note dialog */}
      <NoteDialog
        open={showNoteDialog}
        onOpenChange={setShowNoteDialog}
        family={selectedFamily}
        isPending={createNoteMutation.isPending}
        onSubmit={(content, date) =>
          selectedFamily && createNoteMutation.mutate({ familyId: selectedFamily.id, content, date })
        }
      />
    </div>
  );
}

function AidDialog({
  open,
  onOpenChange,
  family,
  categories,
  getCategoryLabel,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: Family | null;
  categories: Category[];
  getCategoryLabel: (id: string) => string;
  isPending: boolean;
  onSubmit: (data: {
    familyId: string;
    type: string;
    quantity: number;
    date: string;
    source: AidSource;
    notes?: string;
  }) => void;
}) {
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [source, setSource] = useState<AidSource>("donation");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !type) return;
    onSubmit({
      familyId: family.id,
      type,
      quantity,
      date,
      source,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer une aide</DialogTitle>
        </DialogHeader>
        {family && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Famille N° {family.number} — {family.responsibleName || "—"}
            </p>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getCategoryLabel(c.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantité</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as AidSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AID_SOURCE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques..."
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !type}>
                {isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  family,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: Family | null;
  isPending: boolean;
  onSubmit: (content: string, date: string) => void;
}) {
  const [content, setContent] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim(), date);
    setContent("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une note</DialogTitle>
        </DialogHeader>
        {family && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Famille N° {family.number} — {family.responsibleName || "—"}
            </p>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Note de visite..."
                rows={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !content.trim()}>
                {isPending ? "Envoi..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
