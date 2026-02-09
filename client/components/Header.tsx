import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Heart,
  LayoutDashboard,
  Users,
  AlertTriangle,
  Gift,
  FileBarChart,
  LogOut,
  User,
  Shield,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const adminNavItems: NavItem[] = [
  { path: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { path: "/families", label: "Familles", icon: Users },
  { path: "/needs", label: "Besoins", icon: AlertTriangle },
  { path: "/aids", label: "Aides", icon: Gift },
  { path: "/reports", label: "Rapports", icon: FileBarChart },
];

const volunteerNavItems: NavItem[] = [
  { path: "/dashboard", label: "Mes actions", icon: ClipboardList },
  { path: "/families", label: "Familles", icon: Users },
  { path: "/needs", label: "Besoins", icon: AlertTriangle },
  { path: "/aids", label: "Aides", icon: Gift },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  const navItems = isAdmin ? adminNavItems : volunteerNavItems;

  return (
    <header className={`sticky top-0 z-50 border-b shadow-sm ${isAdmin ? "bg-white border-gray-200" : "bg-blue-50 border-blue-200"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isAdmin ? "bg-primary" : "bg-blue-600"}`}>
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground">SocialAid</h1>
              <p className="text-xs text-muted-foreground leading-none">
                {isAdmin ? "Administration" : "Espace bénévole"}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User Info + Logout */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 text-sm">
                <div className={`p-1.5 rounded-full ${isAdmin ? "bg-amber-100" : "bg-blue-100"}`}>
                  {isAdmin ? (
                    <Shield className="w-4 h-4 text-amber-600" />
                  ) : (
                    <User className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="hidden lg:block">
                  <p className="font-medium text-foreground leading-none text-xs">
                    {user.name}
                  </p>
                  <p className={`text-xs mt-0.5 font-medium ${isAdmin ? "text-amber-600" : "text-blue-600"}`}>
                    {isAdmin ? "Administrateur" : "Bénévole"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="lg:hidden pb-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                >
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {user && (
              <div className="pt-2 border-t border-gray-200 mt-2">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm">
                    <p className="font-medium">{user.name}</p>
                    <p className={`text-xs font-medium ${isAdmin ? "text-amber-600" : "text-blue-600"}`}>
                      {isAdmin ? "Administrateur" : "Bénévole"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-red-600"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </Button>
                </div>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
