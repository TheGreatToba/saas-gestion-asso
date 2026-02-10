import { Link, useLocation, useNavigate } from "react-router-dom";
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
  UserCog,
  Shield,
  ClipboardList,
  Package,
  Search,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";

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
  { path: "/stock", label: "Stock", icon: Package },
  { path: "/reports", label: "Rapports", icon: FileBarChart },
  { path: "/users", label: "Utilisateurs", icon: UserCog },
];

const volunteerNavItems: NavItem[] = [
  { path: "/dashboard", label: "Mes actions", icon: ClipboardList },
  { path: "/families", label: "Familles", icon: Users },
  { path: "/needs", label: "Besoins", icon: AlertTriangle },
  { path: "/aids", label: "Aides", icon: Gift },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchMobileRef = useRef<HTMLDivElement>(null);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { getCategoryLabel } = useCategories();

  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: searchResult, isLoading: searchLoading } = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () => api.searchGlobal(debouncedQ),
    enabled: debouncedQ.length >= 2,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDesktop = searchRef.current?.contains(target);
      const inMobile = searchMobileRef.current?.contains(target);
      if (!inDesktop && !inMobile) setSearchFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = searchFocused && debouncedQ.length >= 2;
  const hasResults =
    searchResult &&
    (searchResult.families.length > 0 ||
      searchResult.needs.length > 0 ||
      searchResult.aids.length > 0);

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

          {/* Global search (desktop) */}
          <div
            className={`hidden md:block flex-1 mx-4 transition-all duration-200 ${
              searchFocused ? "max-w-2xl" : "max-w-xs"
            }`}
            ref={searchRef}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher familles, besoins, aides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="pl-8 h-9 bg-muted/50"
              />
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto">
                  {searchLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">Recherche...</div>
                  ) : !hasResults ? (
                    <div className="p-4 text-sm text-muted-foreground">Aucun résultat</div>
                  ) : (
                    <div className="py-2">
                      {searchResult!.families.length > 0 && (
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                          Familles
                        </div>
                      )}
                      {searchResult!.families.slice(0, 5).map((f) => (
                        <Link
                          key={f.id}
                          to={`/families/${f.id}`}
                          onClick={() => {
                            setSearchQuery("");
                            setSearchFocused(false);
                          }}
                          className="block px-4 py-2 hover:bg-muted text-sm"
                        >
                          {f.responsibleName}
                          <span className="text-muted-foreground ml-1">— {f.neighborhood}</span>
                        </Link>
                      ))}
                      {searchResult!.needs.length > 0 && (
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-2">
                          Besoins
                        </div>
                      )}
                      {searchResult!.needs.slice(0, 5).map((n) => (
                          <div key={n.id} className="flex items-center gap-2">
                            <Link
                              to={`/needs`}
                              onClick={() => {
                                setSearchQuery("");
                                setSearchFocused(false);
                              }}
                              className="flex-1 px-4 py-2 hover:bg-muted text-sm"
                            >
                              {getCategoryLabel(n.type)}
                              <span className="text-muted-foreground ml-1">
                                — {(n as { familyName?: string }).familyName ?? "Famille"}
                              </span>
                            </Link>
                            <Link
                              to={`/aids?action=add&familyId=${n.familyId}&type=${n.type}`}
                              onClick={() => {
                                setSearchQuery("");
                                setSearchFocused(false);
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded"
                            >
                              Répondre
                            </Link>
                          </div>
                        ))}
                      {searchResult!.aids.length > 0 && (
                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-2">
                          Aides
                        </div>
                      )}
                      {searchResult!.aids.slice(0, 5).map((a) => (
                          <Link
                            key={a.id}
                            to={`/aids`}
                            onClick={() => {
                              setSearchQuery("");
                              setSearchFocused(false);
                            }}
                            className="block px-4 py-2 hover:bg-muted text-sm"
                          >
                            {getCategoryLabel(a.type)} x{a.quantity}
                            <span className="text-muted-foreground ml-1">
                              — {(a as { familyName?: string }).familyName ?? "Famille"}
                            </span>
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

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

        {/* Global search (mobile) */}
        <div className="md:hidden pb-3" ref={searchMobileRef}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher familles, besoins, aides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className="pl-8 h-10 bg-muted/50"
            />
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Recherche...</div>
                ) : !hasResults ? (
                  <div className="p-4 text-sm text-muted-foreground">Aucun résultat</div>
                ) : (
                  <div className="py-2">
                    {searchResult!.families.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        Familles
                      </div>
                    )}
                    {searchResult!.families.slice(0, 5).map((f) => (
                      <Link
                        key={f.id}
                        to={`/families/${f.id}`}
                        onClick={() => {
                          setSearchQuery("");
                          setSearchFocused(false);
                        }}
                        className="block px-4 py-2 hover:bg-muted text-sm"
                      >
                        {f.responsibleName}
                        <span className="text-muted-foreground ml-1">
                          — {f.neighborhood}
                        </span>
                      </Link>
                    ))}
                    {searchResult!.needs.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-2">
                        Besoins
                      </div>
                    )}
                    {searchResult!.needs.slice(0, 5).map((n) => (
                      <div key={n.id} className="flex items-center gap-2">
                        <Link
                          to={`/needs`}
                          onClick={() => {
                            setSearchQuery("");
                            setSearchFocused(false);
                          }}
                          className="flex-1 px-4 py-2 hover:bg-muted text-sm"
                        >
                          {getCategoryLabel(n.type)}
                          <span className="text-muted-foreground ml-1">
                            — {(n as { familyName?: string }).familyName ?? "Famille"}
                          </span>
                        </Link>
                        <Link
                          to={`/aids?action=add&familyId=${n.familyId}&type=${n.type}`}
                          onClick={() => {
                            setSearchQuery("");
                            setSearchFocused(false);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded"
                        >
                          Répondre
                        </Link>
                      </div>
                    ))}
                    {searchResult!.aids.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-2">
                        Aides
                      </div>
                    )}
                    {searchResult!.aids.slice(0, 5).map((a) => (
                      <Link
                        key={a.id}
                        to={`/aids`}
                        onClick={() => {
                          setSearchQuery("");
                          setSearchFocused(false);
                        }}
                        className="block px-4 py-2 hover:bg-muted text-sm"
                      >
                        {getCategoryLabel(a.type)} x{a.quantity}
                        <span className="text-muted-foreground ml-1">
                          — {(a as { familyName?: string }).familyName ?? "Famille"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
