import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { User } from "@shared/schema";
import type { LoginResponse } from "@shared/api";
import { clearSession, readSession, setSessionToken, writeSession } from "@/lib/session";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize user from session on mount
  useEffect(() => {
    // 1) Lecture optimiste depuis localStorage pour éviter le flash de logout.
    const session = readSession();
    if (session?.user) {
      setUser(session.user);
    }

    // 2) Vérification serveur de la session réelle via le cookie HttpOnly.
    api
      .getMe()
      .then((me) => {
        setUser(me.user);
      })
      .catch(() => {
        setUser(null);
        clearSession();
        setSessionToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || "Erreur de connexion" };
      }

      const data = (await res.json()) as LoginResponse;

      // En phase de migration, on ne dépend plus du token côté client :
      // le cookie HttpOnly sert de source d'autorisation principale.
      writeSession({ user: data.user, token: data.token });

      // Update user state last to trigger re-render
      setUser(data.user);

      return { success: true };
    } catch {
      return { success: false, error: "Erreur réseau" };
    }
  };

  const logout = async () => {
    try {
      // Demander au serveur d'invalider le cookie auth_token.
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
      // On ignore les erreurs réseau : on nettoie quand même le client.
    } finally {
      setUser(null);
      clearSession();
      setSessionToken(null);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
