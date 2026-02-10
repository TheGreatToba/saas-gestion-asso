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
    const session = readSession();
    if (session?.user && session?.token) {
      setUser(session.user);
      setSessionToken(session.token);
    } else {
      clearSession();
    }
    setIsLoading(false);
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
      setUser(data.user);
      setSessionToken(data.token);
      writeSession({ user: data.user, token: data.token });
      return { success: true };
    } catch {
      return { success: false, error: "Erreur réseau" };
    }
  };

  const logout = () => {
    setUser(null);
    clearSession();
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
