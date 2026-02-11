import { useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileDown,
  FileSpreadsheet,
  BarChart3,
  Users,
  AlertTriangle,
  Gift,
  Calendar,
  Printer,
  History,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import {
  CreateFamilySchema,
  NEED_URGENCY_LABELS,
  NEED_STATUS_LABELS,
  PRIORITY_LABELS,
  AID_SOURCE_LABELS,
  FAMILY_HOUSING_LABELS,
} from "@shared/schema";
import type { CreateFamilyInput, EnrichedNeed } from "@shared/schema";
import { priorityBadgeClasses } from "@/lib/utils";
import { parseCsv, normalizeHeader } from "@/lib/csv";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  family: "Famille",
  child: "Enfant",
  need: "Besoin",
  aid: "Aide",
  note: "Note",
  category: "Catégorie",
  article: "Article",
  user: "Utilisateur",
};
const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "Créé",
  updated: "Modifié",
  deleted: "Supprimé",
};

type FieldKey = keyof CreateFamilyInput;
type MappingRule = {
  source: "column" | "fixed";
  column?: string;
  fixed?: string;
};

const FIELD_DEFS: {
  key: FieldKey;
  label: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "housing";
  placeholder?: string;
  defaultValue?: string;
}[] = [
  { key: "responsibleName", label: "Nom du responsable", required: false, type: "string" },
  { key: "phone", label: "Téléphone", required: false, type: "string" },
  { key: "address", label: "Adresse", required: false, type: "string" },
  { key: "neighborhood", label: "Quartier", required: false, type: "string" },
  { key: "memberCount", label: "Membres", required: false, type: "number", defaultValue: "0" },
  { key: "childrenCount", label: "Enfants", required: false, type: "number", defaultValue: "0" },
  { key: "housing", label: "Hébergement", required: false, type: "housing", defaultValue: "not_housed" },
  { key: "housingName", label: "Nom du foyer", required: false, type: "string" },
  { key: "healthNotes", label: "Maladies et spécificités", required: false, type: "string" },
  { key: "hasMedicalNeeds", label: "Cas médical (oui/non)", required: false, type: "boolean", defaultValue: "non" },
  { key: "notes", label: "Notes", required: false, type: "string" },
];

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  responsibleName: ["nom", "responsable", "chef", "beneficiaire", "bénéficiaire"],
  phone: ["telephone", "téléphone", "tel", "gsm", "mobile"],
  address: ["adresse", "address"],
  neighborhood: ["quartier", "neighborhood", "secteur", "zone"],
  memberCount: ["membres", "membre", "famille", "taille"],
  childrenCount: ["enfants", "enfant", "children"],
  housing: ["hebergement", "hébergement", "foyer", "housing", "situation"],
  housingName: ["nom foyer", "foyer", "centre", "hebergement"],
  healthNotes: ["sante", "santé", "maladie", "medical", "médical"],
  hasMedicalNeeds: ["cas medical", "médical", "medical", "priorite medicale"],
  notes: ["notes", "commentaire", "remarque"],
};

export default function Reports() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { categories, getCategoryLabel } = useCategories();
  const [exporting, setExporting] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, MappingRule>>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<import("@shared/api").ImportFamiliesResult | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.getDashboardStats,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies(),
  });

  // Admin: reset complet des familles (hard delete)
  const resetFamiliesMutation = useMutation({
    mutationFn: api.resetAllFamilies,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Familles réinitialisées",
        description: `${data.purged} famille(s) ont été supprimées.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur lors de la réinitialisation",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { data: needs = [] } = useQuery({
    queryKey: ["needs-all"],
    queryFn: api.getNeeds,
  });

  const { data: aids = [] } = useQuery({
    queryKey: ["aids-all"],
    queryFn: api.getAids,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.getAuditLogs(100),
    enabled: !!isAdmin,
  });

  const normalizePhone = (value?: string) => (value ?? "").replace(/\D/g, "");

  const guessMapping = (headers: string[]): Record<FieldKey, MappingRule> => {
    const headerMap = new Map(
      headers.map((h) => [normalizeHeader(h), h]),
    );
    const initial: Record<FieldKey, MappingRule> = {} as Record<
      FieldKey,
      MappingRule
    >;
    FIELD_DEFS.forEach((field) => {
      const aliases = FIELD_ALIASES[field.key] ?? [];
      const match = aliases
        .map((alias) => headerMap.get(normalizeHeader(alias)))
        .find(Boolean);
      if (match) {
        initial[field.key] = { source: "column", column: match };
      } else if (field.defaultValue !== undefined) {
        initial[field.key] = { source: "fixed", fixed: field.defaultValue };
      } else {
        initial[field.key] = { source: "column", column: "" };
      }
    });
    return initial;
  };

  const detectDelimiter = (text: string) => {
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    return semiCount > commaCount ? ";" : ",";
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseCsv(text, detectDelimiter(text));
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMapping(guessMapping(parsed.headers));
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const parseBoolean = (value: string | undefined): boolean | undefined => {
    if (!value) return undefined;
    const raw = value.trim().toLowerCase();
    if (["oui", "yes", "true", "1"].includes(raw)) return true;
    if (["non", "no", "false", "0"].includes(raw)) return false;
    return undefined;
  };

  const parseNumber = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const num = parseInt(value.replace(/[^\d-]/g, ""), 10);
    return Number.isNaN(num) ? undefined : num;
  };

  const parseHousing = (value: string | undefined): CreateFamilyInput["housing"] | undefined => {
    if (!value) return undefined;
    const normalized = normalizeHeader(value);
    if (normalized.includes("heberg") || normalized.includes("foyer")) return "housed";
    if (normalized.includes("attente") || normalized.includes("placement")) return "pending_placement";
    if (normalized.includes("sans") || normalized.includes("domicile")) return "not_housed";
    if (["housed", "pending_placement", "not_housed"].includes(normalized)) {
      return normalized as CreateFamilyInput["housing"];
    }
    return undefined;
  };

  const mappedRows = useMemo(() => {
    if (csvRows.length === 0) return [];
    return csvRows.map((row) => {
      const record: Partial<CreateFamilyInput> = {};
      FIELD_DEFS.forEach((field) => {
        const rule = mapping[field.key];
        let rawValue = "";
        if (rule?.source === "column" && rule.column) {
          const idx = csvHeaders.indexOf(rule.column);
          rawValue = idx >= 0 ? (row[idx] ?? "") : "";
        }
        if (rule?.source === "fixed") {
          rawValue = rule.fixed ?? "";
        }
        const trimmed = rawValue.toString().trim();
        if (!trimmed && field.defaultValue) {
          rawValue = field.defaultValue;
        }

        if (field.type === "number") {
          const val = parseNumber(rawValue.toString());
          if (val !== undefined) record[field.key] = val as never;
          return;
        }
        if (field.type === "boolean") {
          const val = parseBoolean(rawValue.toString());
          if (val !== undefined) record[field.key] = val as never;
          return;
        }
        if (field.type === "housing") {
          const val = parseHousing(rawValue.toString());
          if (val) record[field.key] = val as never;
          return;
        }
        if (trimmed) record[field.key] = trimmed as never;
      });
      return record;
    });
  }, [csvRows, csvHeaders, mapping]);

  const existingPhones = useMemo(() => {
    return new Set(families.map((f) => normalizePhone(f.phone)));
  }, [families]);

  const missingRequiredFields = useMemo(() => {
    if (csvHeaders.length === 0) return [];
    return FIELD_DEFS.filter((field) => field.required).filter((field) => {
      const rule = mapping[field.key];
      if (!rule) return true;
      if (rule.source === "fixed") {
        return !rule.fixed || !rule.fixed.trim();
      }
      return !rule.column;
    });
  }, [csvHeaders.length, mapping]);

  const validationRows = useMemo(() => {
    if (mappedRows.length === 0) return [];
    const seenPhones = new Set<string>();
    return mappedRows.map((row, index) => {
      const prepared: CreateFamilyInput = {
        responsibleName: row.responsibleName ?? "",
        phone: row.phone ?? "",
        address: row.address ?? "",
        neighborhood: row.neighborhood ?? "",
        memberCount: row.memberCount ?? 1,
        childrenCount: row.childrenCount ?? 0,
        housing: row.housing ?? "not_housed",
        housingName: row.housingName ?? "",
        healthNotes: row.healthNotes ?? "",
        hasMedicalNeeds: row.hasMedicalNeeds ?? false,
        notes: row.notes ?? "",
      };
      const validation = CreateFamilySchema.safeParse(prepared);
      const normalizedPhone = normalizePhone(prepared.phone);
      const duplicateExisting =
        !!normalizedPhone && existingPhones.has(normalizedPhone);
      let duplicateInFile = false;
      if (normalizedPhone) {
        if (seenPhones.has(normalizedPhone)) {
          duplicateInFile = true;
        } else {
          seenPhones.add(normalizedPhone);
        }
      }
      return {
        index: index + 1,
        prepared,
        valid: validation.success,
        duplicateExisting,
        duplicateInFile,
        errors: validation.success ? {} : validation.error.flatten().fieldErrors,
      };
    });
  }, [mappedRows, existingPhones]);

  const invalidCountAll = useMemo(
    () => validationRows.filter((row) => !row.valid).length,
    [validationRows],
  );

  const duplicateExistingCount = useMemo(
    () => validationRows.filter((row) => row.duplicateExisting).length,
    [validationRows],
  );

  const duplicateInFileCount = useMemo(
    () => validationRows.filter((row) => row.duplicateInFile).length,
    [validationRows],
  );

  const validationErrorsPreview = useMemo(() => {
    const labelMap = new Map(FIELD_DEFS.map((field) => [field.key, field.label]));
    return validationRows
      .filter((row) => !row.valid)
      .slice(0, 5)
      .map((row) => {
        const fields = Object.keys(row.errors).map(
          (key) => labelMap.get(key as FieldKey) ?? key,
        );
        return {
          row: row.index,
          message: fields.length
            ? `Champs manquants/invalides : ${fields.join(", ")}`
            : "Données invalides",
        };
      });
  }, [validationRows]);

  const preview = useMemo(() => {
    if (mappedRows.length === 0) return [];
    return mappedRows.slice(0, 10).map((row) => {
      const prepared: CreateFamilyInput = {
        responsibleName: row.responsibleName ?? "",
        phone: row.phone ?? "",
        address: row.address ?? "",
        neighborhood: row.neighborhood ?? "",
        memberCount: row.memberCount ?? 1,
        childrenCount: row.childrenCount ?? 0,
        housing: row.housing ?? "not_housed",
        housingName: row.housingName ?? "",
        healthNotes: row.healthNotes ?? "",
        hasMedicalNeeds: row.hasMedicalNeeds ?? false,
        notes: row.notes ?? "",
      };
      const validation = CreateFamilySchema.safeParse(prepared);
      const duplicate = !!prepared.phone && existingPhones.has(normalizePhone(prepared.phone));
      return {
        prepared,
        valid: validation.success,
        duplicate,
      };
    });
  }, [mappedRows, existingPhones]);

  const exportCSV = (type: "families" | "needs" | "aids") => {
    setExporting(true);
    try {
      let csv = "";
      let filename = "";

      if (type === "families") {
        csv =
          "Nom,Téléphone,Adresse,Quartier,Membres,Enfants,Hébergement,Nom du foyer,Maladies et spécificités,Cas médical,Notes,Dernière visite\n";
        families.forEach((f) => {
          csv += `"${f.responsibleName}","${f.phone}","${f.address}","${f.neighborhood}",${f.memberCount},${f.childrenCount},"${FAMILY_HOUSING_LABELS[f.housing]}","${(f.housingName || "").replace(/"/g, '""')}","${(f.healthNotes || "").replace(/"/g, '""')}","${f.hasMedicalNeeds ? "Oui" : "Non"}","${(f.notes || "").replace(/"/g, '""')}","${f.lastVisitAt ? format(new Date(f.lastVisitAt), "dd/MM/yyyy") : "Jamais"}"\n`;
        });
        filename = "familles.csv";
      } else if (type === "needs") {
        csv = "Famille,Type,Urgence,Statut,Détails,Commentaire,Date\n";
        needs.forEach((n) => {
          const family = families.find((f) => f.id === n.familyId);
          csv += `"${family?.responsibleName || "Inconnu"}","${getCategoryLabel(n.type)}","${NEED_URGENCY_LABELS[n.urgency]}","${NEED_STATUS_LABELS[n.status]}","${(n.details || "").replace(/"/g, '""')}","${(n.comment || "").replace(/"/g, '""')}","${format(new Date(n.createdAt), "dd/MM/yyyy")}"\n`;
        });
        filename = "besoins.csv";
      } else {
        csv = "Famille,Type,Quantité,Source,Bénévole,Notes,Date\n";
        aids.forEach((a) => {
          const family = families.find((f) => f.id === a.familyId);
          csv += `"${family?.responsibleName || "Inconnu"}","${getCategoryLabel(a.type)}",${a.quantity},"${AID_SOURCE_LABELS[a.source]}","${a.volunteerName}","${(a.notes || "").replace(/"/g, '""')}","${format(new Date(a.date), "dd/MM/yyyy")}"\n`;
        });
        filename = "aides.csv";
      }

      // BOM for UTF-8 in Excel
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = FIELD_DEFS.map((f) => f.label).join(";");
    const csv = `${header}\n`;
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-familles-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  // Calculate need stats by type
  const needsByType = categories.map((cat) => ({
    type: cat.id,
    label: cat.name,
    total: needs.filter((n) => n.type === cat.id).length,
    pending: needs.filter((n) => n.type === cat.id && n.status === "pending")
      .length,
    urgent: needs.filter(
      (n) => n.type === cat.id && n.urgency === "high" && n.status !== "covered"
    ).length,
  }));

  // Calculate aid stats by type
  const aidsByType = categories.map((cat) => {
    const typeAids = aids.filter((a) => a.type === cat.id);
    return {
      type: cat.id,
      label: cat.name,
      count: typeAids.length,
      totalQuantity: typeAids.reduce((sum, a) => sum + a.quantity, 0),
    };
  });

  // Families needing attention
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const unvisitedFamilies = families.filter((f) => {
    if (!f.lastVisitAt) return true;
    return new Date(f.lastVisitAt) < thirtyDaysAgo;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Rapports & Export
            </h1>
            <p className="text-muted-foreground mt-1">
              Rapport généré le{" "}
              {format(new Date(), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={printReport}>
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
        </div>

        {/* Export Buttons */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Export de données (CSV)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="gap-2 h-auto py-4 flex-col"
              onClick={() => exportCSV("families")}
              disabled={exporting}
            >
              <Users className="w-6 h-6 text-primary" />
              <span className="font-medium">Familles</span>
              <span className="text-xs text-muted-foreground">
                {families.length} entrées
              </span>
            </Button>
            <Button
              variant="outline"
              className="gap-2 h-auto py-4 flex-col"
              onClick={() => exportCSV("needs")}
              disabled={exporting}
            >
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <span className="font-medium">Besoins</span>
              <span className="text-xs text-muted-foreground">
                {needs.length} entrées
              </span>
            </Button>
            <Button
              variant="outline"
              className="gap-2 h-auto py-4 flex-col"
              onClick={() => exportCSV("aids")}
              disabled={exporting}
            >
              <Gift className="w-6 h-6 text-green-600" />
              <span className="font-medium">Aides</span>
              <span className="text-xs text-muted-foreground">
                {aids.length} entrées
              </span>
            </Button>
          </div>
        </div>

        {/* Import CSV + reset familles (admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Import CSV (familles)</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  Télécharger un modèle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={resetFamiliesMutation.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Cette action va supprimer TOUTES les familles (et leurs enfants, besoins, aides, notes, documents), mais conservera les comptes utilisateurs.\n\nEs-tu sûr de vouloir réinitialiser toutes les familles ?",
                      )
                    ) {
                      return;
                    }
                    resetFamiliesMutation.mutate();
                  }}
                >
                  Supprimer toutes les familles
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Import initial ou reprise de données. La détection des doublons se
              fait par numéro de téléphone.
            </p>

            <div className="grid gap-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <Label className="min-w-40">Fichier CSV</Label>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) handleCsvUpload(file);
                  }}
                />
              </div>

              {csvHeaders.length > 0 && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-medium mb-3">
                      Mapping des colonnes
                    </p>
                    <div className="grid gap-3">
                      {FIELD_DEFS.map((field) => {
                        const rule = mapping[field.key] || {
                          source: "column",
                          column: "",
                        };
                        const selectValue =
                          rule.source === "fixed"
                            ? "__fixed"
                            : rule.column || "__none";
                        return (
                          <div
                            key={field.key}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                          >
                            <Label className="sm:col-span-3">
                              {field.label}
                              {field.required && " *"}
                            </Label>
                            <div className="sm:col-span-5">
                              <Select
                                value={selectValue}
                                onValueChange={(value) => {
                                  if (value === "__fixed") {
                                    setMapping((prev) => ({
                                      ...prev,
                                      [field.key]: {
                                        source: "fixed",
                                        fixed:
                                          prev[field.key]?.fixed ??
                                          field.defaultValue ??
                                          "",
                                      },
                                    }));
                                    return;
                                  }
                                  if (value === "__none") {
                                    setMapping((prev) => ({
                                      ...prev,
                                      [field.key]: {
                                        source: "column",
                                        column: "",
                                      },
                                    }));
                                    return;
                                  }
                                  setMapping((prev) => ({
                                    ...prev,
                                    [field.key]: { source: "column", column: value },
                                  }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir une colonne" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">Ignorer</SelectItem>
                                  {csvHeaders.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__fixed">Valeur fixe</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-4">
                              {rule.source === "fixed" && (
                                <>
                                  {field.type === "housing" ? (
                                    <Select
                                      value={rule.fixed ?? field.defaultValue ?? "not_housed"}
                                      onValueChange={(value) =>
                                        setMapping((prev) => ({
                                          ...prev,
                                          [field.key]: { source: "fixed", fixed: value },
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="housed">Hébergé</SelectItem>
                                        <SelectItem value="pending_placement">
                                          En attente
                                        </SelectItem>
                                        <SelectItem value="not_housed">
                                          Sans hébergement
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : field.type === "boolean" ? (
                                    <Select
                                      value={rule.fixed ?? field.defaultValue ?? "non"}
                                      onValueChange={(value) =>
                                        setMapping((prev) => ({
                                          ...prev,
                                          [field.key]: { source: "fixed", fixed: value },
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="oui">Oui</SelectItem>
                                        <SelectItem value="non">Non</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={rule.fixed ?? ""}
                                      onChange={(e) =>
                                        setMapping((prev) => ({
                                          ...prev,
                                          [field.key]: {
                                            source: "fixed",
                                            fixed: e.target.value,
                                          },
                                        }))
                                      }
                                      placeholder={field.defaultValue ?? "Valeur"}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex items-center gap-2">
                      <Label>Doublons (téléphone)</Label>
                      <Select
                        value={duplicateStrategy}
                        onValueChange={(v: "skip" | "update") => setDuplicateStrategy(v)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Ignorer</SelectItem>
                          <SelectItem value="update">Mettre à jour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {csvRows.length} ligne{csvRows.length !== 1 ? "s" : ""} détectée{csvRows.length !== 1 ? "s" : ""}
                    </div>
                  </div>


                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-medium">Prévisualisation</p>
                      {invalidCountAll > 0 && (
                        <Badge variant="destructive">{invalidCountAll} ligne(s) invalide(s)</Badge>
                      )}
                      {duplicateExistingCount > 0 && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          {duplicateExistingCount} doublon(s) existants
                        </Badge>
                      )}
                      {duplicateInFileCount > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200">
                          {duplicateInFileCount} doublon(s) dans le fichier
                        </Badge>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-3">Nom</th>
                            <th className="py-2 pr-3">Téléphone</th>
                            <th className="py-2 pr-3">Quartier</th>
                            <th className="py-2 pr-3">Membres</th>
                            <th className="py-2 pr-3">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="py-2 pr-3">{row.prepared.responsibleName || "—"}</td>
                              <td className="py-2 pr-3">{row.prepared.phone || "—"}</td>
                              <td className="py-2 pr-3">{row.prepared.neighborhood || "—"}</td>
                              <td className="py-2 pr-3">{row.prepared.memberCount}</td>
                              <td className="py-2 pr-3">
                                {!row.valid ? (
                                  <span className="text-red-600">Invalide</span>
                                ) : row.duplicate ? (
                                  <span className="text-orange-600">Doublon</span>
                                ) : (
                                  <span className="text-green-600">OK</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {validationErrorsPreview.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      <p className="font-medium mb-2">Erreurs détectées (extrait)</p>
                      <div className="space-y-1">
                        {validationErrorsPreview.map((err) => (
                          <div key={`row-${err.row}`}>Ligne {err.row}: {err.message}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button
                      onClick={async () => {
                        setImporting(true);
                        try {
                          const result = await api.importFamilies({
                            rows: mappedRows,
                            duplicateStrategy,
                          });
                          setImportResult(result);
                          toast({
                            title: "Import terminé",
                            description: `${result.created} créées, ${result.updated} mises à jour, ${result.skipped} ignorées`,
                          });
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Erreur";
                          setImportResult(null);
                          toast({
                            title: "Erreur d'import",
                            description: message,
                            variant: "destructive",
                          });
                        } finally {
                          setImporting(false);
                        }
                      }}
                      disabled={mappedRows.length === 0 || importing}
                      className="gap-2"
                    >
                      {importing ? "Import en cours..." : `Importer ${mappedRows.length} ligne(s)`}
                    </Button>
                    {importResult && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>
                          {importResult.created} créées, {importResult.updated} mises à jour, {importResult.skipped} ignorées
                          {importResult.errors.length > 0 && (
                            <span className="text-red-600 ml-2">
                              {importResult.errors.length} erreur(s)
                            </span>
                          )}
                        </div>
                        {(importResult.createdFamilies.length > 0 || importResult.updatedFamilies.length > 0) && (
                          <div className="text-xs text-muted-foreground mt-2 space-y-1">
                            {importResult.createdFamilies.length > 0 && (
                              <div>
                                <strong>Familles créées :</strong>{" "}
                                {importResult.createdFamilies.map((f, idx) => (
                                  <span key={f.id}>
                                    Ligne {f.row} → N° {f.familyNumber}
                                    {idx < importResult.createdFamilies.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {importResult.updatedFamilies.length > 0 && (
                              <div>
                                <strong>Familles mises à jour :</strong>{" "}
                                {importResult.updatedFamilies.map((f, idx) => (
                                  <span key={f.id}>
                                    Ligne {f.row} → N° {f.familyNumber}
                                    {idx < importResult.updatedFamilies.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {importResult && importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      <p className="font-medium mb-2">Erreurs détectées</p>
                      <div className="space-y-1">
                        {importResult.errors.slice(0, 5).map((err, idx) => (
                          <div key={`${err.row}-${idx}`}>
                            Ligne {err.row}: {err.message}
                          </div>
                        ))}
                        {importResult.errors.length > 5 && (
                          <div>+{importResult.errors.length - 5} autres erreurs</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Audit log (admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique des modifications
            </h2>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Utilisateur</th>
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-muted-foreground text-center">
                        Aucune modification enregistrée
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </td>
                        <td className="py-2 pr-4">{log.userName}</td>
                        <td className="py-2 pr-4">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</td>
                        <td className="py-2 pr-4">{AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{log.details ?? log.entityId}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                Total familles
              </span>
            </div>
            <p className="text-3xl font-bold">{stats?.totalFamilies ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-muted-foreground">
                Besoins urgents
              </span>
            </div>
            <p className="text-3xl font-bold text-red-600">
              {stats?.urgentNeeds ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="w-5 h-5 text-green-600" />
              <span className="text-sm text-muted-foreground">
                Aides ce mois
              </span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {stats?.aidsThisMonth ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-muted-foreground">
                Non visitées
              </span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.familiesNotVisited ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Needs by Type */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Besoins par type
            </h2>
            <div className="space-y-3">
              {needsByType
                .filter((n) => n.total > 0)
                .sort((a, b) => b.total - a.total)
                .map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.urgent > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {item.urgent} urgent
                          {item.urgent > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{
                            width: `${Math.min(
                              (item.total / Math.max(...needsByType.map((n) => n.total), 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {item.total}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Aids by Type */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Aides par type
            </h2>
            <div className="space-y-3">
              {aidsByType
                .filter((a) => a.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({item.totalQuantity} unités)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-green-500 rounded-full h-2 transition-all"
                          style={{
                            width: `${Math.min(
                              (item.count / Math.max(...aidsByType.map((a) => a.count), 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Families needing attention */}
        {unvisitedFamilies.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-600" />
              Familles non visitées depuis plus de 30 jours
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Nom</th>
                    <th className="pb-2 font-medium">Quartier</th>
                    <th className="pb-2 font-medium">Téléphone</th>
                    <th className="pb-2 font-medium">Dernière visite</th>
                    <th className="pb-2 font-medium">Membres</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {unvisitedFamilies.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium">{f.responsibleName}</td>
                      <td className="py-3 text-muted-foreground">
                        {f.neighborhood}
                      </td>
                      <td className="py-3 text-muted-foreground">{f.phone}</td>
                      <td className="py-3 text-muted-foreground">
                        {f.lastVisitAt
                          ? format(new Date(f.lastVisitAt), "dd/MM/yyyy")
                          : "Jamais"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {f.memberCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Distribution list */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Liste de distribution terrain
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Besoins en attente, triés par urgence (à imprimer pour les visites
            terrain)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Famille</th>
                  <th className="pb-2 font-medium">Quartier</th>
                  <th className="pb-2 font-medium">Besoin</th>
                  <th className="pb-2 font-medium">Détails</th>
                  <th className="pb-2 font-medium">Urgence</th>
                  <th className="pb-2 font-medium">Distribué</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {needs
                  .filter((n) => n.status !== "covered")
                  .sort((a, b) => {
                    const urgencyOrder = { high: 0, medium: 1, low: 2 };
                    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                  })
                  .map((need) => {
                    const family = families.find(
                      (f) => f.id === need.familyId
                    );
                    return (
                      <tr key={need.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium">
                          {family?.responsibleName || "Inconnu"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {family?.neighborhood || "—"}
                        </td>
                        <td className="py-3">
                          {getCategoryLabel(need.type)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {need.details || "—"}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant="outline"
                            className={priorityBadgeClasses((need as unknown as EnrichedNeed).priorityLevel || "medium")}
                          >
                            {(need as unknown as EnrichedNeed).priorityLevel
                              ? PRIORITY_LABELS[(need as unknown as EnrichedNeed).priorityLevel]
                              : NEED_URGENCY_LABELS[need.urgency]}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
