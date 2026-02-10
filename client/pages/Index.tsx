import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users,
  TrendingUp,
  Shield,
  Zap,
  Heart,
  BarChart3,
  Calendar,
  CheckCircle,
  ArrowRight,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-white">
      {/* Simple Landing Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SocialAid</h1>
                <p className="text-xs text-muted-foreground leading-none">
                  Gestion de l'aide sociale
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/register">
                <Button variant="outline" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Créer un compte
                </Button>
              </Link>
              <Link to="/login">
                <Button className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 opacity-60" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Gérez l'aide sociale avec
              <span className="text-primary ml-3">transparence</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl">
              Une plateforme complète pour centraliser les familles bénéficiaires,
              suivre les besoins réels, et apporter une aide adaptée et dignifiante.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register">
                <Button size="lg" className="gap-2">
                  Créer un compte <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">
                  En savoir plus
                </Button>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 pt-16 border-t border-gray-200">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">100%</div>
              <p className="text-muted-foreground text-sm mt-2">
                Transparence des données
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary">0</div>
              <p className="text-muted-foreground text-sm mt-2">Doublons d'aide</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">24/7</div>
              <p className="text-muted-foreground text-sm mt-2">
                Historique complet
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Fonctionnalités principales
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer efficacement l'aide sociale
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "Gestion des familles",
                description:
                  "Centralisez toutes les informations sur les familles bénéficiaires en un seul endroit.",
              },
              {
                icon: TrendingUp,
                title: "Suivi des besoins",
                description:
                  "Identifiez et priorisez les besoins réels avec un système de priorités clair.",
              },
              {
                icon: Heart,
                title: "Enregistrement des aides",
                description:
                  "Tracez chaque aide apportée pour éviter les doublons et assurer l'efficacité.",
              },
              {
                icon: BarChart3,
                title: "Statistiques et rapports",
                description:
                  "Visualisez l'impact de votre action avec des tableaux de bord détaillés.",
              },
              {
                icon: Shield,
                title: "Sécurité des données",
                description:
                  "Protégez les informations sensibles avec un accès par rôles et historique complet.",
              },
              {
                icon: Zap,
                title: "Rapide et intuitif",
                description:
                  "Interface simple et mobile-friendly pour une utilisation sur le terrain.",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-8 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Pour les administrateurs et bénévoles
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Une solution complète adaptée à vos besoins
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary/10">
                      <Users className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Administrateurs
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Paramétrage complet, gestion des utilisateurs, statistiques
                      globales et exports détaillés.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/20">
                      <Heart className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Bénévoles & Travailleurs sociaux
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Ajoutez des familles, mettez à jour les besoins, enregistrez
                      les aides et ajoutez des notes après visite.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                <Calendar className="w-8 h-8 text-primary mb-3" />
                <p className="font-semibold text-foreground text-sm">
                  Historique complet
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Timeline de toutes les actions
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                <CheckCircle className="w-8 h-8 text-secondary mb-3" />
                <p className="font-semibold text-foreground text-sm">
                  Sans doublons
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Suivi des aides données
                </p>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg">
                <Zap className="w-8 h-8 text-accent mb-3" />
                <p className="font-semibold text-foreground text-sm">
                  Rapide & Mobile
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  30 secondes pour enregistrer une aide
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                <Shield className="w-8 h-8 text-foreground mb-3" />
                <p className="font-semibold text-foreground text-sm">
                  Données sécurisées
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Chiffrées et protégées
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 bg-gradient-to-r from-primary to-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Prêt à améliorer votre gestion de l'aide sociale?
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            Commencez dès maintenant avec un accès complet à la plateforme.
            Aucune configuration nécessaire.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 text-primary hover:text-primary/80"
              >
                Créer un compte <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 bg-white/20 border-white/40 text-white hover:bg-white/30"
              >
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="bg-primary p-2 rounded-lg">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-foreground">SocialAid</h3>
          </div>
          <p className="text-center text-muted-foreground text-sm">
            Une plateforme dédiée à la gestion transparente et efficace de l'aide
            sociale. © 2025 - Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
