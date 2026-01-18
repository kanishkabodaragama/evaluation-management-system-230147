"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";
import {
  InlineAlert,
  PaginationControls,
  useDebouncedValue,
} from "@/components/ui/crud";
import {
  CsvDownloadLink,
  formatNumber,
  formatPercent,
  MiniBarChart,
  SummaryCards,
} from "@/components/ui/analytics";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import type {
  ReviewSession,
  SessionAnalyticsSummary,
  SessionEmployeeAnalyticsRow,
  SessionReviewerAnalyticsRow,
} from "@/lib/api";
import {
  getEmployeesExportCsvUrl,
  getSessionAnalyticsSummary,
  getSessionExportCsvUrl,
  listSessions,
  listSessionEmployeeAnalytics,
  listSessionReviewerAnalytics,
} from "@/lib/api";

type TabKey = "summary" | "employees" | "reviewers";

async function downloadCsvWithAuth(opts: {
  url: string;
  filename: string;
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (!token) throw new Error("You must be signed in to download exports.");

  const res = await fetch(opts.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `CSV download failed (${res.status}) ${res.statusText}: ${text || "No body"}`,
    );
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  // Trigger browser download without navigating away.
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
}

export default function AnalyticsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Analytics" description="Session metrics, employee performance, reviewer activity, and exports.">
        <AnalyticsDashboard />
      </Page>
    </RequireAuth>
  );
}

function AnalyticsDashboard() {
  const { session } = useAuth();

  // Session picker
  const [sessionQuery, setSessionQuery] = useState("");
  const debouncedSessionQuery = useDebouncedValue(sessionQuery, 350);

  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Tabs
  const [tab, setTab] = useState<TabKey>("summary");

  // Summary data
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionAnalyticsSummary | null>(null);

  // Employee table
  const [empLimit, setEmpLimit] = useState(20);
  const [empOffset, setEmpOffset] = useState(0);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [empRows, setEmpRows] = useState<SessionEmployeeAnalyticsRow[]>([]);
  const [empTotal, setEmpTotal] = useState(0);

  // Reviewer table
  const [revLimit, setRevLimit] = useState(20);
  const [revOffset, setRevOffset] = useState(0);
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);
  const [revRows, setRevRows] = useState<SessionReviewerAnalyticsRow[]>([]);
  const [revTotal, setRevTotal] = useState(0);

  // CSV download status
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading">("idle");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        // Keep this list small and fast; admins typically have limited sessions.
        const res = await listSessions({
          limit: 50,
          offset: 0,
          sortBy: "created_at",
          sortDir: "desc",
          q: debouncedSessionQuery ? debouncedSessionQuery : undefined,
        });

        if (cancelled) return;

        setSessions(res.items);
        // Default selection: first session in list (if none chosen).
        if (!selectedSessionId && res.items.length > 0) {
          setSelectedSessionId(res.items[0].id);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setSessionsError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        if (cancelled) return;
        setSessionsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSessionQuery, selectedSessionId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedSessionId) {
        setSummary(null);
        return;
      }
      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const res = await getSessionAnalyticsSummary(selectedSessionId);
        if (cancelled) return;
        setSummary(res);
      } catch (err: unknown) {
        if (cancelled) return;
        setSummaryError(err instanceof Error ? err.message : "Failed to load session analytics");
      } finally {
        if (cancelled) return;
        setSummaryLoading(false);
      }
    }

    // Always refresh summary when selection changes (even if tab isn't summary, for cards).
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (tab !== "employees") return;
      if (!selectedSessionId) return;

      setEmpLoading(true);
      setEmpError(null);

      try {
        const res = await listSessionEmployeeAnalytics({
          sessionId: selectedSessionId,
          limit: empLimit,
          offset: empOffset,
        });
        if (cancelled) return;
        setEmpRows(res.items);
        setEmpTotal(res.total);
      } catch (err: unknown) {
        if (cancelled) return;
        setEmpError(err instanceof Error ? err.message : "Failed to load employee analytics");
      } finally {
        if (cancelled) return;
        setEmpLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, selectedSessionId, empLimit, empOffset]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (tab !== "reviewers") return;
      if (!selectedSessionId) return;

      setRevLoading(true);
      setRevError(null);

      try {
        const res = await listSessionReviewerAnalytics({
          sessionId: selectedSessionId,
          limit: revLimit,
          offset: revOffset,
        });
        if (cancelled) return;
        setRevRows(res.items);
        setRevTotal(res.total);
      } catch (err: unknown) {
        if (cancelled) return;
        setRevError(err instanceof Error ? err.message : "Failed to load reviewer analytics");
      } finally {
        if (cancelled) return;
        setRevLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, selectedSessionId, revLimit, revOffset]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const summaryCards = useMemo(() => {
    const counts = summary?.counts;
    const avgs = summary?.averages;

    return [
      {
        label: "Assignments",
        value: counts ? formatNumber(counts.assignments_count) : "—",
        hint: "Total assignments in session",
      },
      {
        label: "Submitted",
        value: counts ? formatNumber(counts.submissions_submitted_count) : "—",
        hint: "Submissions with status=submitted",
      },
      {
        label: "Completion rate",
        value: counts ? formatPercent(counts.assignment_completion_rate_pct, 1) : "—",
        hint: "Assignments completed / total",
      },
      {
        label: "Avg overall score",
        value: avgs ? formatNumber(avgs.avg_overall_score, 2) : "—",
        hint: "Across submissions with scores",
      },
    ];
  }, [summary]);

  const criterionChartData = useMemo(() => {
    const rows = summary?.per_criterion ?? [];
    return rows
      .slice()
      .sort((a, b) => (b.avg_score_value ?? -1) - (a.avg_score_value ?? -1))
      .map((r) => ({
        label: r.criterion_name,
        value: r.avg_score_value,
      }));
  }, [summary]);

  const sessionCsvUrl = useMemo(() => {
    if (!selectedSessionId) return "";
    return getSessionExportCsvUrl(selectedSessionId);
  }, [selectedSessionId]);

  const employeesCsvUrl = useMemo(() => {
    return getEmployeesExportCsvUrl({
      session_id: selectedSessionId || undefined,
    });
  }, [selectedSessionId]);

  const canDownload = !!session?.user && !!selectedSessionId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="crud-toolbar">
        <div className="crud-filters">
          <label className="field">
            <span className="field-label">Session</span>
            <select
              className="input"
              value={selectedSessionId}
              onChange={(e) => {
                setEmpOffset(0);
                setRevOffset(0);
                setSelectedSessionId(e.target.value);
              }}
              disabled={sessionsLoading}
            >
              {sessions.length === 0 ? <option value="">No sessions</option> : null}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Filter sessions</span>
            <input
              className="input"
              placeholder="Search name…"
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="crud-actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              // "Refresh": retrigger effects by resetting offsets and keeping same selection.
              setEmpOffset((o) => o);
              setRevOffset((o) => o);
              setSelectedSessionId((id) => id);
            }}
            disabled={sessionsLoading || summaryLoading}
          >
            Refresh
          </button>

          <button
            type="button"
            className="button"
            disabled={!canDownload || downloadStatus !== "idle"}
            title={
              !selectedSessionId
                ? "Select a session first"
                : "Download requires an authenticated Bearer token"
            }
            onClick={async () => {
              if (!selectedSessionId) return;

              setDownloadError(null);
              setDownloadStatus("downloading");
              try {
                await downloadCsvWithAuth({
                  url: sessionCsvUrl,
                  filename: `session-${selectedSessionId}.csv`,
                });
              } catch (err: unknown) {
                setDownloadError(err instanceof Error ? err.message : "Failed to download CSV");
              } finally {
                setDownloadStatus("idle");
              }
            }}
          >
            {downloadStatus === "downloading" ? "Downloading…" : "Download session CSV"}
          </button>

          <button
            type="button"
            className="button"
            disabled={!canDownload || downloadStatus !== "idle"}
            title="Employees export CSV (optionally filtered to selected session)"
            onClick={async () => {
              setDownloadError(null);
              setDownloadStatus("downloading");
              try {
                await downloadCsvWithAuth({
                  url: employeesCsvUrl,
                  filename: `employees-export${selectedSessionId ? `-session-${selectedSessionId}` : ""}.csv`,
                });
              } catch (err: unknown) {
                setDownloadError(err instanceof Error ? err.message : "Failed to download CSV");
              } finally {
                setDownloadStatus("idle");
              }
            }}
          >
            {downloadStatus === "downloading" ? "Downloading…" : "Download employees CSV"}
          </button>
        </div>
      </div>

      {sessionsError ? <InlineAlert kind="error">{sessionsError}</InlineAlert> : null}
      {summaryError ? <InlineAlert kind="error">{summaryError}</InlineAlert> : null}
      {downloadError ? <InlineAlert kind="error">{downloadError}</InlineAlert> : null}

      <SummaryCards items={summaryCards} />

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={tab === "summary" ? "button button-primary" : "button"}
            onClick={() => setTab("summary")}
          >
            Summary
          </button>
          <button
            type="button"
            className={tab === "employees" ? "button button-primary" : "button"}
            onClick={() => setTab("employees")}
            disabled={!selectedSessionId}
            title={!selectedSessionId ? "Select a session first" : undefined}
          >
            Employees
          </button>
          <button
            type="button"
            className={tab === "reviewers" ? "button button-primary" : "button"}
            onClick={() => setTab("reviewers")}
            disabled={!selectedSessionId}
            title={!selectedSessionId ? "Select a session first" : undefined}
          >
            Reviewers
          </button>
        </div>

        <div className="muted small" style={{ marginTop: 10 }}>
          Selected session:{" "}
          {selectedSession ? (
            <>
              <b>{selectedSession.name}</b> • {selectedSession.status}{" "}
              {selectedSession.start_date ? `• ${selectedSession.start_date}` : ""}{" "}
              {selectedSession.end_date ? `→ ${selectedSession.end_date}` : ""}
            </>
          ) : (
            "—"
          )}
        </div>
      </div>

      {tab === "summary" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {summaryLoading ? <p className="muted">Loading analytics…</p> : null}

          <MiniBarChart title="Average score by criterion" data={criterionChartData} valueSuffix="" />

          <div className="card" style={{ padding: 16 }}>
            <div className="page-title" style={{ fontSize: "1.05rem" }}>
              Exports
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              CSV links below are direct backend URLs. If your environment blocks Authorization headers for
              direct navigation, use the download buttons above (recommended).
            </div>

            <div className="crud-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
              <CsvDownloadLink
                label="Session export (CSV URL)"
                href={sessionCsvUrl}
                disabled={!selectedSessionId}
                title="Direct URL (may require authenticated fetch depending on browser)"
              />
              <CsvDownloadLink
                label="Employees export (CSV URL)"
                href={employeesCsvUrl}
                disabled={false}
                title="Direct URL (may require authenticated fetch depending on browser)"
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "employees" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {empError ? <InlineAlert kind="error">{empError}</InlineAlert> : null}

          <div className="crud-table-wrap">
            <table className="crud-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Team</th>
                  <th>Assignments</th>
                  <th>Submitted</th>
                  <th>Avg score</th>
                </tr>
              </thead>
              <tbody>
                {empLoading ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Loading…
                    </td>
                  </tr>
                ) : empRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No employee analytics found.
                    </td>
                  </tr>
                ) : (
                  empRows.map((r) => (
                    <tr key={r.employee_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.full_name}</div>
                        <div className="muted small">
                          {r.employee_code ? `${r.employee_code} • ` : ""}
                          {r.email ?? "—"}
                        </div>
                      </td>
                      <td className="muted small">{r.team ?? "—"}</td>
                      <td>{formatNumber(r.assignments_count)}</td>
                      <td>{formatNumber(r.submissions_submitted_count)}</td>
                      <td>{formatNumber(r.avg_overall_score, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            total={empTotal}
            limit={empLimit}
            offset={empOffset}
            onChange={({ limit, offset }) => {
              setEmpLimit(limit);
              setEmpOffset(offset);
            }}
          />
        </div>
      ) : null}

      {tab === "reviewers" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {revError ? <InlineAlert kind="error">{revError}</InlineAlert> : null}

          <div className="crud-table-wrap">
            <table className="crud-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Assignments</th>
                  <th>Completed</th>
                  <th>Completion rate</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {revLoading ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Loading…
                    </td>
                  </tr>
                ) : revRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No reviewer analytics found.
                    </td>
                  </tr>
                ) : (
                  revRows.map((r) => (
                    <tr key={r.reviewer_user_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.reviewer_email ?? "Unknown reviewer"}</div>
                        <div className="muted small">{r.reviewer_user_id}</div>
                      </td>
                      <td>{formatNumber(r.assignments_count)}</td>
                      <td>{formatNumber(r.assignments_completed_count)}</td>
                      <td>{formatPercent(r.assignment_completion_rate_pct, 1)}</td>
                      <td>{formatNumber(r.submissions_submitted_count)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            total={revTotal}
            limit={revLimit}
            offset={revOffset}
            onChange={({ limit, offset }) => {
              setRevLimit(limit);
              setRevOffset(offset);
            }}
          />
        </div>
      ) : null}

      <div className="muted small">
        Note: This dashboard uses client-side fetching only (compatible with Next.js static export). All API calls
        include the Supabase Bearer token via the existing API client.
      </div>
    </div>
  );
}
