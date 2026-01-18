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

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  email: string | null;
  team: string | null;
  title: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type Criterion = {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReviewSession = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  status: "draft" | "active" | "closed" | "archived";
  created_at: string;
  updated_at: string;
};

export type SessionAssignmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type SessionAssignment = {
  id: string;
  session_id: string;
  employee_id: string;
  reviewer_user_id: string;
  status: SessionAssignmentStatus;
  created_at: string;
  updated_at: string;
};

export type SubmissionStatus = "draft" | "submitted" | "reopened";

export type Submission = {
  id: string;
  session_id: string;
  employee_id: string;
  reviewer_user_id: string;
  assignment_id: string | null;
  status: SubmissionStatus;
  overall_comment: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Score = {
  id: string;
  submission_id: string;
  criterion_id: string;
  score_value: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionAnalyticsSummary = {
  session: ReviewSession;
  counts: {
    session_id: string;
    assignments_count: number;
    submissions_count: number;
    submissions_submitted_count: number;
    assignments_completed_count: number;
    assignment_completion_rate_pct: number; // 0-100
  };
  averages: {
    avg_overall_score: number | null;
    submissions_with_any_score_count: number;
  };
  per_criterion: Array<{
    criterion_id: string;
    criterion_name: string;
    weight: number;
    avg_score_value: number | null;
    score_count: number;
  }>;
};

export type SessionEmployeeAnalyticsRow = {
  employee_id: string;
  employee_code: string | null;
  full_name: string;
  email: string | null;
  team: string | null;
  assignments_count: number;
  submissions_count: number;
  submissions_submitted_count: number;
  avg_overall_score: number | null;
};

export type SessionReviewerAnalyticsRow = {
  reviewer_user_id: string;
  reviewer_email: string | null;
  assignments_count: number;
  assignments_completed_count: number;
  assignment_completion_rate_pct: number;
  submissions_submitted_count: number;
};

// PUBLIC_INTERFACE
export async function fetchMe(): Promise<MeResponse> {
  /** Fetch the current user profile from backend to determine role-based routing. */
  return apiFetch<MeResponse>("/me");
}

function buildQuery(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// Employees
// PUBLIC_INTERFACE
export async function listEmployees(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: "active" | "inactive";
  team?: string;
  q?: string;
}): Promise<ListResponse<Employee>> {
  /** List employees (admin-only). Supports pagination, sort, and filters. */
  return apiFetch<ListResponse<Employee>>(`/api/employees${buildQuery(args)}`);
}

// PUBLIC_INTERFACE
export async function createEmployee(payload: {
  employee_code?: string | null;
  full_name: string;
  email?: string | null;
  team?: string | null;
  title?: string | null;
  status?: "active" | "inactive";
}): Promise<Employee> {
  /** Create an employee (admin-only). */
  const res = await apiFetch<{ item: Employee }>(`/api/employees`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function updateEmployee(
  id: string,
  payload: Partial<{
    employee_code: string | null;
    full_name: string;
    email: string | null;
    team: string | null;
    title: string | null;
    status: "active" | "inactive";
  }>,
): Promise<Employee> {
  /** Update an employee (admin-only). */
  const res = await apiFetch<{ item: Employee }>(`/api/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function deleteEmployee(id: string): Promise<{ status: string }> {
  /** Delete an employee (admin-only). */
  return apiFetch<{ status: string }>(`/api/employees/${id}`, { method: "DELETE" });
}

// Criteria
// PUBLIC_INTERFACE
export async function listCriteria(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  is_active?: boolean;
}): Promise<ListResponse<Criterion>> {
  /** List criteria (admin-only). Supports pagination, sort, and is_active filter. */
  return apiFetch<ListResponse<Criterion>>(`/api/criteria${buildQuery(args)}`);
}

// PUBLIC_INTERFACE
export async function createCriterion(payload: {
  name: string;
  description?: string | null;
  weight?: number;
  sort_order?: number;
  is_active?: boolean;
}): Promise<Criterion> {
  /** Create a criterion (admin-only). */
  const res = await apiFetch<{ item: Criterion }>(`/api/criteria`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function updateCriterion(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    weight: number;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<Criterion> {
  /** Update a criterion (admin-only). */
  const res = await apiFetch<{ item: Criterion }>(`/api/criteria/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function deleteCriterion(id: string): Promise<{ status: string }> {
  /** Delete a criterion (admin-only). */
  return apiFetch<{ status: string }>(`/api/criteria/${id}`, { method: "DELETE" });
}

// Sessions
// PUBLIC_INTERFACE
export async function listSessions(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  status?: "draft" | "active" | "closed" | "archived";
  q?: string;
}): Promise<ListResponse<ReviewSession>> {
  /** List review sessions (admin-only). Supports pagination, sort, and filters. */
  return apiFetch<ListResponse<ReviewSession>>(`/api/sessions${buildQuery(args)}`);
}

// PUBLIC_INTERFACE
export async function createSession(payload: {
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: "draft" | "active" | "closed" | "archived";
}): Promise<ReviewSession> {
  /** Create a review session (admin-only). */
  const res = await apiFetch<{ item: ReviewSession }>(`/api/sessions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function updateSession(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: "draft" | "active" | "closed" | "archived";
  }>,
): Promise<ReviewSession> {
  /** Update a review session (admin-only). */
  const res = await apiFetch<{ item: ReviewSession }>(`/api/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function deleteSession(id: string): Promise<{ status: string }> {
  /** Delete a review session (admin-only). */
  return apiFetch<{ status: string }>(`/api/sessions/${id}`, { method: "DELETE" });
}

// Assignments (reviewer-scoped by backend)
// PUBLIC_INTERFACE
export async function listAssignments(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  session_id?: string;
  employee_id?: string;
}): Promise<ListResponse<SessionAssignment>> {
  /** List assignments for the logged-in reviewer (backend enforces reviewer_user_id scoping). */
  return apiFetch<ListResponse<SessionAssignment>>(
    `/api/assignments${buildQuery(args)}`,
  );
}

// PUBLIC_INTERFACE
export async function getAssignment(id: string): Promise<SessionAssignment> {
  /** Get a specific assignment (reviewer-scoped by backend). */
  const res = await apiFetch<{ item: SessionAssignment }>(`/api/assignments/${id}`);
  return res.item;
}

// Submissions (reviewer-scoped by backend)
// PUBLIC_INTERFACE
export async function listSubmissions(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  session_id?: string;
  employee_id?: string;
  status?: SubmissionStatus;
}): Promise<ListResponse<Submission>> {
  /** List submissions for the logged-in reviewer (backend enforces reviewer_user_id scoping). */
  return apiFetch<ListResponse<Submission>>(
    `/api/submissions${buildQuery(args)}`,
  );
}

// PUBLIC_INTERFACE
export async function createSubmission(payload: {
  session_id: string;
  employee_id: string;
  assignment_id?: string | null;
  status?: SubmissionStatus;
  overall_comment?: string | null;
}): Promise<Submission> {
  /** Create a submission for the logged-in reviewer (backend forces reviewer_user_id). */
  const res = await apiFetch<{ item: Submission }>(`/api/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// PUBLIC_INTERFACE
export async function updateSubmission(
  id: string,
  payload: Partial<{
    status: SubmissionStatus;
    overall_comment: string | null;
    submitted_at: string | null;
  }>,
): Promise<Submission> {
  /** Update a submission for the logged-in reviewer (backend enforces ownership). */
  const res = await apiFetch<{ item: Submission }>(`/api/submissions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// Scores (reviewer must filter by submission_id per backend)
// PUBLIC_INTERFACE
export async function listScores(args: {
  limit: number;
  offset: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  submission_id: string;
}): Promise<ListResponse<Score>> {
  /** List scores for a submission (reviewer must provide submission_id; backend enforces ownership). */
  return apiFetch<ListResponse<Score>>(`/api/scores${buildQuery(args)}`);
}

// PUBLIC_INTERFACE
export async function createScore(payload: {
  submission_id: string;
  criterion_id: string;
  score_value: number;
  comment?: string | null;
}): Promise<Score> {
  /** Create a score for a submission+criterion (unique per pair). */
  const res = await apiFetch<{ item: Score }>(`/api/scores`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.item;
}

/**
 * Returns the absolute URL for an API path (used for direct downloads like CSV).
 */
function toAbsoluteApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

// PUBLIC_INTERFACE
export async function updateScore(
  id: string,
  payload: Partial<{
    score_value: number;
    comment: string | null;
  }>,
): Promise<Score> {
  /** Update an existing score record. */
  const res = await apiFetch<{ item: Score }>(`/api/scores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.item;
}

// Analytics (admin-only)
// PUBLIC_INTERFACE
export async function getSessionAnalyticsSummary(
  sessionId: string,
): Promise<SessionAnalyticsSummary> {
  /** Fetch session-level summary analytics. */
  return apiFetch<SessionAnalyticsSummary>(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}`,
  );
}

// PUBLIC_INTERFACE
export async function listSessionEmployeeAnalytics(args: {
  sessionId: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<SessionEmployeeAnalyticsRow>> {
  /** Paginated employee analytics rows within a session. */
  const { sessionId, ...rest } = args;
  return apiFetch<ListResponse<SessionEmployeeAnalyticsRow>>(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}/employees${buildQuery(rest)}`,
  );
}

// PUBLIC_INTERFACE
export async function listSessionReviewerAnalytics(args: {
  sessionId: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<SessionReviewerAnalyticsRow>> {
  /** Paginated reviewer analytics rows within a session. */
  const { sessionId, ...rest } = args;
  return apiFetch<ListResponse<SessionReviewerAnalyticsRow>>(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}/reviewers${buildQuery(rest)}`,
  );
}

// PUBLIC_INTERFACE
export function getSessionExportCsvUrl(sessionId: string): string {
  /** Build a direct-download URL for session export CSV. */
  return toAbsoluteApiUrl(
    `/api/analytics/sessions/${encodeURIComponent(sessionId)}/export.csv`,
  );
}

// PUBLIC_INTERFACE
export function getEmployeesExportCsvUrl(args?: { session_id?: string }): string {
  /** Build a direct-download URL for employees export CSV (optionally filtered by session_id). */
  const qs = buildQuery({ session_id: args?.session_id });
  return toAbsoluteApiUrl(`/api/analytics/employees/export.csv${qs}`);
}
