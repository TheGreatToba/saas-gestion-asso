import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileDown,
  FileSpreadsheet,
  BarChart3,
  Users,
  AlertTriangle,
  Gift,
  Calendar,
  Printer,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/useCategories";
import {
  NEED_URGENCY_LABELS,
  NEED_STATUS_LABELS,
  PRIORITY_LABELS,
  AID_SOURCE_LABELS,
  FAMILY_HOUSING_LABELS,
} from "@shared/schema";
import type { EnrichedNeed } from "@shared/schema";
import { statusBadgeClasses, priorityBadgeClasses } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Reports() {
  const { user } = useAuth();
  const { categories, getCategoryLabel } = useCategories();
  const [exporting, setExporting] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.getDashboardStats,
  });

  const { data: families = [] } = useQuery({
    queryKey: ["families"],
    queryFn: () => api.getFamilies(),
  });

  const { data: needs = [] } = useQuery({
    queryKey: ["needs-all"],
    queryFn: api.getNeeds,
  });

  const { data: aids = [] } = useQuery({
    queryKey: ["aids-all"],
    queryFn: api.getAids,
  });

  const exportCSV = (type: "families" | "needs" | "aids") => {
    setExporting(true);
    try {
      let csv = "";
      let filename = "";

      if (type === "families") {
        csv =
          "Nom,Téléphone,Adresse,Quartier,Membres,Enfants,Hébergement,Maladies et spécificités,Cas médical,Notes,Dernière visite\n";
        families.forEach((f) => {
          csv += `"${f.responsibleName}","${f.phone}","${f.address}","${f.neighborhood}",${f.memberCount},${f.childrenCount},"${FAMILY_HOUSING_LABELS[f.housing]}","${(f.healthNotes || "").replace(/"/g, '""')}","${f.hasMedicalNeeds ? "Oui" : "Non"}","${(f.notes || "").replace(/"/g, '""')}","${f.lastVisitAt ? format(new Date(f.lastVisitAt), "dd/MM/yyyy") : "Jamais"}"\n`;
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
