import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  AlertCircle,
  Gift,
  Clock,
  Plus,
  ArrowRight,
  FileText,
  Heart,
  ClipboardList,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  NEED_TYPE_LABELS,
  NEED_URGENCY_LABELS,
  AID_SOURCE_LABELS,
} from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ===================== ADMIN DASHBOARD =====================

function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.getDashboardStats,
    refetchInterval: 30000,
  });

  const statCards = [
    {
      label: "Familles aidées",
      value: stats?.totalFamilies ?? 0,
      icon: Users,
      color: "from-blue-50 to-blue-100",
      iconColor: "text-primary",
      link: "/families",
    },
    {
      label: "Besoins urgents",
      value: stats?.urgentNeeds ?? 0,
      icon: AlertCircle,
      color: "from-red-50 to-red-100",
      iconColor: "text-red-600",
      link: "/needs",
    },
    {
      label: "Aides ce mois",
      value: stats?.aidsThisMonth ?? 0,
      icon: Gift,
      color: "from-green-50 to-green-100",
      iconColor: "text-secondary",
      link: "/aids",
    },
    {
      label: "Non visitées (>30j)",
      value: stats?.familiesNotVisited ?? 0,
      icon: Clock,
      color: "from-yellow-50 to-yellow-100",
      iconColor: "text-yellow-600",
      link: "/families",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Vue d'ensemble
        </h1>
        <p className="text-muted-foreground">
          Bienvenue {user?.name} ! Voici un aperçu global de votre plateforme d'aide sociale.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Link key={idx} to={stat.link}>
              <div
                className={`bg-gradient-to-br ${stat.color} rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">
                      {stat.label}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-9 w-16 mt-1" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <Icon className={`w-8 h-8 ${stat.iconColor}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Needs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-foreground">
                  Besoins urgents
                </h2>
                <Link to="/needs">
                  <Button variant="outline" size="sm" className="gap-2">
                    Voir tous
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : stats?.urgentNeedsList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun besoin urgent en cours</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {stats?.urgentNeedsList.map((need) => (
                  <div
                    key={need.id}
                    className="p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/families/${need.familyId}`}
                          className="font-semibold text-foreground hover:text-primary transition"
                        >
                          {need.familyName}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          {NEED_TYPE_LABELS[need.type]}
                          {need.details ? ` — ${need.details}` : ""}
                        </p>
                        {need.comment && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {need.comment}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {NEED_URGENCY_LABELS[need.urgency]}
                        </span>
                        <Link to={`/aids?action=add&familyId=${need.familyId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            Répondre
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Créé{" "}
                      {formatDistanceToNow(new Date(need.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + Recent Aids */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-foreground mb-4">
              Gestion rapide
            </h3>
            <div className="space-y-3">
              <Link to="/aids?action=add">
                <Button
                  className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Zap className="w-4 h-4" />
                  Enregistrer une aide
                </Button>
              </Link>
              <Link to="/families?action=add">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle famille
                </Button>
              </Link>
              <Link to="/needs?action=add">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <AlertCircle className="w-4 h-4" />
                  Signaler un besoin
                </Button>
              </Link>
              <Link to="/reports">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                >
                  <FileText className="w-4 h-4" />
                  Rapports & export
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Aids */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-foreground mb-4">
              Dernières aides
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {stats?.recentAids.map((aid) => (
                  <div
                    key={aid.id}
                    className="pb-4 border-b last:border-b-0"
                  >
                    <Link
                      to={`/families/${aid.familyId}`}
                      className="font-medium text-sm text-foreground hover:text-primary transition"
                    >
                      {aid.familyName}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {NEED_TYPE_LABELS[aid.type]} — x{aid.quantity}
                    </p>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {aid.volunteerName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(aid.date), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/aids">
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-4 text-primary"
              >
                Voir l'historique complet
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== VOLUNTEER DASHBOARD =====================

function VolunteerDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.getDashboardStats,
    refetchInterval: 30000,
  });

  const quickActions = [
    {
      label: "Ajouter une famille",
      description: "Enregistrer une nouvelle famille à suivre",
      icon: Users,
      link: "/families?action=add",
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      label: "Signaler un besoin",
      description: "Déclarer un nouveau besoin pour une famille",
      icon: AlertCircle,
      link: "/needs?action=add",
      color: "bg-red-50 hover:bg-red-100 border-red-200",
      iconColor: "text-red-600",
    },
    {
      label: "Enregistrer une aide",
      description: "Documenter une aide apportée à une famille",
      icon: Gift,
      link: "/aids?action=add",
      color: "bg-green-50 hover:bg-green-100 border-green-200",
      iconColor: "text-green-600",
    },
    {
      label: "Consulter les familles",
      description: "Voir la liste des familles et ajouter des notes",
      icon: ClipboardList,
      link: "/families",
      color: "bg-purple-50 hover:bg-purple-100 border-purple-200",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-blue-100 p-2.5 rounded-full">
            <Heart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour {user?.name} !
            </h1>
            <p className="text-muted-foreground text-sm">
              Espace bénévole — Que souhaitez-vous faire aujourd'hui ?
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.link} to={action.link}>
              <div
                className={`${action.color} rounded-xl border p-6 transition-all cursor-pointer hover:shadow-md`}
              >
                <Icon className={`w-8 h-8 ${action.iconColor} mb-3`} />
                <h3 className="font-semibold text-foreground text-lg">
                  {action.label}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Urgent Needs to address */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-foreground">
                Besoins urgents à traiter
              </h2>
              {!isLoading && stats?.urgentNeeds ? (
                <Badge variant="destructive">{stats.urgentNeeds}</Badge>
              ) : null}
            </div>
            <Link to="/needs">
              <Button variant="outline" size="sm" className="gap-2">
                Tous les besoins
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : stats?.urgentNeedsList.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun besoin urgent en cours</p>
            <p className="text-sm mt-1">Tout est sous contrôle !</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats?.urgentNeedsList.map((need) => (
              <div
                key={need.id}
                className="p-5 hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-start">
                  <Link
                    to={`/families/${need.familyId}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="font-semibold text-foreground hover:text-primary transition">
                      {need.familyName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {NEED_TYPE_LABELS[need.type]}
                      {need.details ? ` — ${need.details}` : ""}
                    </p>
                    {need.comment && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {need.comment}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      Urgent
                    </span>
                    <Link to={`/aids?action=add&familyId=${need.familyId}`}>
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        Répondre
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== MAIN EXPORT =====================

export default function Dashboard() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {isAdmin ? <AdminDashboard /> : <VolunteerDashboard />}
    </div>
  );
}
