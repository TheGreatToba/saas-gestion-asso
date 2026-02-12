import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ReactNode, useState, useEffect } from "react";
import type { User } from "@shared/schema";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Families from "./pages/Families";
import FamilyDetail from "./pages/FamilyDetail";
import Needs from "./pages/Needs";
import Aids from "./pages/Aids";
import Stock from "./pages/Stock";
import Intervention from "./pages/Intervention";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import { ROUTES } from "@/lib/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [sessionUser, setSessionUser] = useState<User | null>(null);

  // Check session storage as fallback for race condition handling
  useEffect(() => {
    if (!user && !isLoading) {
      const session = localStorage.getItem("socialaid_session");
      if (session) {
        try {
          const parsed = JSON.parse(session) as { user?: User };
          setSessionUser(parsed.user || null);
        } catch {
          setSessionUser(null);
        }
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentUser = user || sessionUser;
  if (!currentUser) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isAdmin } = useAuth();
  const [sessionUser, setSessionUser] = useState<User | null>(null);

  // Check session storage as fallback for race condition handling
  useEffect(() => {
    if (!user && !isLoading) {
      const session = localStorage.getItem("socialaid_session");
      if (session) {
        try {
          const parsed = JSON.parse(session) as { user?: User };
          setSessionUser(parsed.user || null);
        } catch {
          setSessionUser(null);
        }
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentUser = user || sessionUser;
  if (!currentUser) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (currentUser.role !== "admin") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path={ROUTES.home} element={<Index />} />
              <Route path={ROUTES.login} element={<Login />} />
              <Route path={ROUTES.register} element={<Register />} />
              <Route
                path={ROUTES.dashboard}
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.families}
                element={
                  <ProtectedRoute>
                    <Families />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.familyDetail}
                element={
                  <ProtectedRoute>
                    <FamilyDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.needs}
                element={
                  <ProtectedRoute>
                    <Needs />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.intervention}
                element={
                  <ProtectedRoute>
                    <Intervention />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.aids}
                element={
                  <ProtectedRoute>
                    <Aids />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.stock}
                element={
                  <ProtectedRoute>
                    <Stock />
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.reports}
                element={
                  <AdminRoute>
                    <Reports />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.users}
                element={
                  <AdminRoute>
                    <Users />
                  </AdminRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
