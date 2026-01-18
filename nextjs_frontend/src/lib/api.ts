import { supabase } from "@/lib/supabaseClient";

export type UserRole = "admin" | "reviewer";

/**
 * Returns the configured API base URL from env.
 */
function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Please set it in the environment.",
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Get current Supabase session access token (if logged in).
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// PUBLIC_INTERFACE
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  /** Fetch wrapper that adds Authorization header with Supabase JWT if available. */
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const token = await getAccessToken();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API request failed (${res.status}) ${res.statusText}: ${text || "No body"}`,
    );
  }

  // Some endpoints may return empty bodies; try JSON then fallback.
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export type MeResponse = {
  id: string;
  email?: string;
  role: UserRole;
};

// PUBLIC_INTERFACE
export async function fetchMe(): Promise<MeResponse> {
  /** Fetch the current user profile from backend to determine role-based routing. */
  return apiFetch<MeResponse>("/me");
}
