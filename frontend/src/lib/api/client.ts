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

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server. Please check that the backend is running.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, error.detail || "Request failed");
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
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}${queryString}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError(0, "Cannot connect to the server. Please check that the backend is running.");
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new ApiError(response.status, error.detail || "Upload failed");
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
