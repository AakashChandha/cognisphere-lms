import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "@/lib/auth/token-storage";
import { ApiError, type ApiEnvelope } from "@/types/api";
import type { AuthTokens } from "@/types/auth";

/**
 * Relative base URL: in every deployment (local `next dev`, Docker dev, and
 * Docker prod behind Caddy) requests to `/api/*` are proxied to the NestJS
 * backend - see `next.config.ts` rewrites and `caddy/Caddyfile`.
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

let refreshPromise: Promise<RefreshOutcome> | null = null;

/** `rejected` = the server said no (log out); `unreachable` = network/5xx (keep the session). */
interface RefreshOutcome {
  token: string | null;
  reason?: "rejected" | "unreachable";
}

export const NETWORK_ERROR_MESSAGE = "We can't reach the server right now. Check your connection and try again.";

async function refreshAccessToken(): Promise<RefreshOutcome> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return { token: null, reason: "rejected" };

  try {
    const response = await refreshClient.post<ApiEnvelope<AuthTokens>>("/auth/refresh", {
      refreshToken,
    });
    const tokens = response.data.data;
    if (!tokens) return { token: null, reason: "rejected" };
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    return { token: tokens.accessToken };
  } catch (error) {
    const status = (error as AxiosError).response?.status;
    // Only a definite 401/403 from the API means the session is dead. A
    // backend restart (502/503) or a dropped connection must not wipe it.
    return { token: null, reason: status === 401 || status === 403 ? "rejected" : "unreachable" };
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

      const outcome = await refreshPromise;

      if (outcome.token) {
        originalRequest.headers.set("Authorization", `Bearer ${outcome.token}`);
        return apiClient(originalRequest);
      }

      if (outcome.reason === "rejected") {
        tokenStorage.clear();
        unauthorizedHandler?.();
      }
    }

    // No response at all: DNS, offline, backend restarting behind the proxy.
    if (!error.response) {
      throw new ApiError(NETWORK_ERROR_MESSAGE, 0, null);
    }

    const message = humanizeMessage(error.response.data?.message, status);
    const errors = error.response.data?.errors ?? null;
    throw new ApiError(message, status ?? 0, errors);
  },
);

/** Replace bare HTTP phrases ("Bad Request") with something a person can act on. */
function humanizeMessage(message: string | undefined, status: number | undefined): string {
  const bare = !message || /^(bad request|internal server error|unauthorized|forbidden|not found)$/i.test(message);
  if (!bare) return message;
  switch (status) {
    case 400:
      return "Some of the information wasn't accepted. Check the form and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "That item no longer exists.";
    case 413:
      return "That file is too large.";
    case 502:
    case 503:
    case 504:
      return NETWORK_ERROR_MESSAGE;
    default:
      return "Something went wrong on our side. Please try again in a moment.";
  }
}

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
