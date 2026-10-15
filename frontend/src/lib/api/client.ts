import { createClient } from "../supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  return detail ? JSON.stringify(detail) : fallback;
}

async function authenticatedHeaders(customHeaders?: HeadersInit): Promise<Headers> {
  const { data, error } = await createClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new ApiError(401, "Please sign in again to continue.");
  }
  const headers = new Headers(customHeaders);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return headers;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers = await authenticatedHeaders(customHeaders);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server. Please check that the backend is running.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorMessage(error.detail, "Request failed"));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

async function uploadFile<T>(
  path: string,
  file: File,
  params?: Record<string, string>,
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const queryString = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const headers = await authenticatedHeaders();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}${queryString}`, {
      method: "POST",
      body: formData,
      headers,
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server. Please check that the backend is running.");
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, errorMessage(error.detail, "Upload failed"));
  }

  return response.json();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),

  upload: <T>(path: string, file: File, params?: Record<string, string>) =>
    uploadFile<T>(path, file, params),
};

export { ApiError };
