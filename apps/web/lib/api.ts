"use client";

import { createClient } from "@/lib/supabase/client";

// Prefer the build-time env var when it is inlined. Under Turbopack it isn't
// always statically replaced, so fall back by host: any non-localhost browser
// (production or a Vercel preview) talks to the deployed API, and only local
// dev uses localhost. This keeps production working even if the env var is
// missing from a build.
function resolveApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "https://leasepro-ai-api.vercel.app";
  }
  return "http://localhost:8000";
}

const API_URL = resolveApiUrl();

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore body parse errors */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore body parse errors */
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download: downloadFile,
};

export { ApiError };
