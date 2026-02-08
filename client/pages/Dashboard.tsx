import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  AlertCircle,
  Gift,
  Clock,
  Plus,
  ArrowRight,
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

export default function Dashboard() {
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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground">
            Bienvenue {user?.name} ! Voici un aperçu de votre plateforme d'aide
            sociale.
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
                        <div>
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
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {NEED_URGENCY_LABELS[need.urgency]}
                        </span>
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

              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <Link to="/needs">
                  <Button variant="ghost" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un nouveau besoin
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Actions + Recent Aids */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-foreground mb-4">
                Actions rapides
              </h3>
              <div className="space-y-3">
                <Link to="/families?action=add">
                  <Button
                    className="w-full justify-start gap-2"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle famille
                  </Button>
                </Link>
                <Link to="/aids?action=add">
                  <Button
                    className="w-full justify-start gap-2"
                    variant="outline"
                  >
                    <Gift className="w-4 h-4" />
                    Enregistrer une aide
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
    </div>
  );
}
