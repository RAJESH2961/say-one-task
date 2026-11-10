import axios, { AxiosError, type AxiosInstance } from "axios";
import type { ApiErrorBody } from "@/types/api";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Normalised error thrown by every API call. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string | null;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, requestId?: string | null, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /** Field-level validation messages keyed by field name (from 422 responses). */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { field?: string; message?: string }[])
        .filter((d) => d.field)
        .map((d) => [d.field!.split(".").pop()!, (d.message ?? "Invalid value").replace(/^Value error, /, "")]),
    );
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorBody>;
    const body = ax.response?.data?.error;
    if (ax.response && body) {
      return new ApiError(ax.response.status, body.code, body.message, body.request_id, body.details);
    }
    if (ax.response) {
      return new ApiError(ax.response.status, "http_error", `Request failed (${ax.response.status})`);
    }
    if (ax.code === "ECONNABORTED") return new ApiError(0, "timeout", "The server took too long to respond");
    return new ApiError(0, "network_error", "Cannot reach the FocusFlow server. Check your connection.");
  }
  return new ApiError(0, "unknown_error", err instanceof Error ? err.message : "Unexpected error");
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureAuth(tokenGetter: TokenGetter, unauthorizedHandler: UnauthorizedHandler) {
  getToken = tokenGetter;
  onUnauthorized = unauthorizedHandler;
}

export const http: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  // FastAPI expects repeated keys for list params: ?status=todo&status=in_progress
  paramsSerializer: { indexes: null },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = toApiError(err);
    if (apiError.status === 401 && getToken()) onUnauthorized();
    return Promise.reject(apiError);
  },
);
