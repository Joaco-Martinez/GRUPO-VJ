"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type ShopUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  isActive?: boolean;
  client?: {
    id: string;
    nombre?: string;
    apellido?: string;
    dni?: string;
    telefono?: string | null;
    gmail?: string | null;
    category?: string;
    currentBalance?: number;
    creditLimit?: number | null;
    isAccountEnabled?: boolean;
  } | null;
};

type LoginInput = {
  email: string;
  password: string;
};

type ShopAuthContextValue = {
  user: ShopUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  refreshUser: () => Promise<ShopUser | null>;
  login: (data: LoginInput) => Promise<ShopUser | null>;
  logout: () => Promise<void>;
};

const ShopAuthContext = createContext<ShopAuthContextValue | null>(null);

function normalizeUser(data: any): ShopUser | null {
  if (!data) return null;

  if (data.id && data.email) return data;

  if (data.user?.id && data.user?.email) return data.user;

  if (data.data?.id && data.data?.email) return data.data;

  return null;
}

function getErrorMessage(data: any, fallback: string) {
  return data?.message || data?.error || fallback;
}

async function fetchCurrentUser(): Promise<ShopUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);

    const user = normalizeUser(data);

    if (!user) return null;

    // Seguridad: este contexto es solo para tienda
    if (user.role && user.role !== "CLIENTE") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

async function loginRequest(input: LoginInput) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(getErrorMessage(data, "No se pudo iniciar sesión"));
  }

  return data;
}

async function logoutRequest() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(getErrorMessage(data, "No se pudo cerrar sesión"));
  }
}

export function ShopAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ShopUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const login = useCallback(
    async (data: LoginInput) => {
      await loginRequest(data);

      const currentUser = await refreshUser();

      if (!currentUser) {
        throw new Error("No se pudo obtener la sesión del cliente");
      }

      return currentUser;
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Aunque falle el backend, limpiamos el estado local.
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function init() {
      setLoading(true);

      const currentUser = await fetchCurrentUser();

      if (!alive) return;

      setUser(currentUser);
      setLoading(false);
    }

    init();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<ShopAuthContextValue>(
    () => ({
      user,
      loading,
      isLoggedIn: Boolean(user),
      refreshUser,
      login,
      logout,
    }),
    [user, loading, refreshUser, login, logout]
  );

  return (
    <ShopAuthContext.Provider value={value}>
      {children}
    </ShopAuthContext.Provider>
  );
}

export function useShopAuth() {
  const ctx = useContext(ShopAuthContext);

  if (!ctx) {
    throw new Error("useShopAuth debe usarse dentro de ShopAuthProvider");
  }

  return ctx;
}