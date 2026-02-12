import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { User } from "@shared/schema";
import type { LoginResponse } from "@shared/api";
import { clearSession, readSession, writeSession } from "@/lib/session";
import { api, getCsrfToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string; pending?: boolean }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Preload CSRF token so login/register can send it
  useEffect(() => {
    getCsrfToken().catch(() => {});
  }, []);

  // Initialize user from session on mount
  useEffect(() => {
    const session = readSession();
    if (session?.user) {
      setUser(session.user);
    }

    api
      .getMe()
      .then((me) => {
        setUser(me.user);
      })
      .catch(() => {
        setUser(null);
        clearSession();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return {
          success: false,
          error:
            data.error ||
            "Erreur de connexion. Vérifiez vos identifiants ou réessayez dans quelques instants.",
        };
      }

      const data = (await res.json()) as LoginResponse;
      writeSession({ user: data.user });
      setUser(data.user);
      return { success: true };
    } catch {
      return {
        success: false,
        error:
          "Erreur réseau lors de la connexion. Vérifiez votre connexion (Wi‑Fi/4G) et réessayez.",
      };
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error:
            responseData.error ||
            "Erreur lors de l'inscription. Vérifiez les informations saisies ou réessayez plus tard.",
        };
      }

      if (responseData.pending) {
        return { success: true, pending: true };
      }

      const { user } = responseData as LoginResponse;
      writeSession({ user });
      setUser(user);
      return { success: true };
    } catch {
      return {
        success: false,
        error:
          "Erreur réseau lors de l'inscription. Vérifiez votre connexion (Wi‑Fi/4G) et réessayez.",
      };
    }
  };

  const logout = async () => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      });
    } catch {
      // On ignore les erreurs réseau : on nettoie quand même le client.
    } finally {
      setUser(null);
      clearSession();
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, isAdmin }}>
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
