const API_BASE = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? window.location.origin : "http://localhost:5000");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getApiBase() {
  return API_BASE.replace(/\/$/, "");
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const payload = await response.json().catch(() => ({}));
  const data = payload.data ?? payload;

  if (!response.ok) {
    throw new ApiError(payload.message || data.message || "Request failed", response.status);
  }

  return data;
}

export function downloadUrl(path) {
  return `${getApiBase()}${path}`;
}
