import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "@/lib/auth/token-storage";
import { ApiError, type ApiEnvelope } from "@/types/api";
import type { AuthTokens } from "@/types/auth";

/**
 * Relative base URL: in every deployment (local `next dev`, Docker dev, and
 * Docker prod behind Nginx) requests to `/api/*` are proxied to the NestJS
 * backend - see `next.config.ts` rewrites and `nginx/default.conf.template`.
 * This keeps the browser client same-origin, avoiding CORS entirely.
 */
export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 30_000,
});

/** Bare instance used only for the refresh call, bypassing interceptors below to avoid recursive refresh loops. */
const refreshClient = axios.create({ baseURL: "/api", timeout: 30_000 });

let unauthorizedHandler: (() => void) | null = null;

/** Registered once by the auth provider so the client can force a logout when refresh fails. */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await refreshClient.post<ApiEnvelope<AuthTokens>>("/auth/refresh", {
      refreshToken,
    });
    const tokens = response.data.data;
    if (!tokens) return null;
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens.accessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");

    if (status === 401 && originalRequest && !originalRequest._retried && !isAuthEndpoint) {
      originalRequest._retried = true;

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      }

      tokenStorage.clear();
      unauthorizedHandler?.();
    }

    const message = error.response?.data?.message ?? error.message ?? "An unexpected error occurred.";
    const errors = error.response?.data?.errors ?? null;
    throw new ApiError(message, status ?? 0, errors);
  },
);

/** Unwraps the standard `{ data }` envelope, throwing an `ApiError` if the request failed. */
export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  if (!response.data.success) {
    throw new ApiError(response.data.message, 0, response.data.errors);
  }
  return response.data.data as T;
}

/** Unwraps a paginated response into `{ items, meta }`. */
export async function unwrapPaginated<T>(
  promise: Promise<{ data: ApiEnvelope<T[]> }>,
): Promise<{ items: T[]; meta: NonNullable<ApiEnvelope<T[]>["pagination"]> }> {
  const response = await promise;
  if (!response.data.success) {
    throw new ApiError(response.data.message, 0, response.data.errors);
  }
  return {
    items: response.data.data ?? [],
    meta: response.data.pagination ?? { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  };
}
