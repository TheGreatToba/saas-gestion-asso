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
import Dashboard from "./pages/Dashboard";
import Families from "./pages/Families";
import FamilyDetail from "./pages/FamilyDetail";
import Needs from "./pages/Needs";
import Aids from "./pages/Aids";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

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
    return <Navigate to="/login" replace />;
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
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
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
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/families"
                element={
                  <ProtectedRoute>
                    <Families />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/families/:id"
                element={
                  <ProtectedRoute>
                    <FamilyDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/needs"
                element={
                  <ProtectedRoute>
                    <Needs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aids"
                element={
                  <ProtectedRoute>
                    <Aids />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <AdminRoute>
                    <Reports />
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
