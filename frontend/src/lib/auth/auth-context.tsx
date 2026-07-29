"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth.api";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/token-storage";
import { getPrimaryRole } from "@/lib/constants/roles";
import type { AppRole, AuthenticatedUser } from "@/types/auth";
import { ApiError } from "@/types/api";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  primaryRole: AppRole | null;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const clearSession = React.useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      router.push("/login");
    });
  }, [clearSession, router]);

  React.useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      const accessToken = tokenStorage.getAccessToken();
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void rehydrate();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = React.useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    const authenticatedUser: AuthenticatedUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      roles: result.user.roles,
    };
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const logout = React.useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      if (!(error instanceof ApiError)) {
        console.error("Failed to revoke refresh token during logout", error);
      }
    } finally {
      clearSession();
      router.push("/login");
    }
  }, [clearSession, router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      primaryRole: user ? getPrimaryRole(user.roles) : null,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
