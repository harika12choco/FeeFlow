import axios, { AxiosError } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "feeflow_token";

export const api = axios.create({ baseURL: API_BASE });

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear the token so the app routes back to login.
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setToken(null);
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an Axios/FastAPI error. */
export function errorMessage(err: unknown): string {
  const ax = err as AxiosError<{ detail?: unknown }>;
  const detail = ax?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    return first.msg || "Request failed";
  }
  if (ax?.message) return ax.message;
  return "Something went wrong. Please try again.";
}
