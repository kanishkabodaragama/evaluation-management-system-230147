"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";
import {
  InlineAlert,
  PaginationControls,
  SortHeader,
  useDebouncedValue,
} from "@/components/ui/crud";
import type { SubmissionStatus, SessionAssignment } from "@/lib/api";
import { listAssignments, listSubmissions } from "@/lib/api";

type SortDir = "asc" | "desc";
type SortBy = "created_at" | "updated_at" | "status" | "session_id" | "employee_id";

type AssignmentRow = SessionAssignment & {
  derived: {
    submissionStatus: SubmissionStatus | null;
    submissionId: string | null;
  };
};

function statusBadge(status: "pending" | "submitted") {
  const cls =
    status === "submitted" ? "button button-success" : "button";
  return (
    <span
      className={cls}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: "0.85rem",
        cursor: "default",
      }}
    >
      {status === "submitted" ? "Submitted" : "Pending"}
    </span>
  );
}

export default function AssignmentsPage() {
  return (
    <RequireAuth allowedRoles={["reviewer"]}>
      <Page title="Assignments" description="Your assigned evaluations to complete.">
        <ReviewerAssignments />
      </Page>
    </RequireAuth>
  );
}

function ReviewerAssignments() {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Filters
  const [sessionId, setSessionId] = useState("");
  const debouncedSessionId = useDebouncedValue(sessionId, 350);
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "submitted">(
    "pending",
  );

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const queryArgs = useMemo(
    () => ({
      limit,
      offset,
      sortBy,
      sortDir,
      session_id: debouncedSessionId ? debouncedSessionId : undefined,
    }),
    [limit, offset, sortBy, sortDir, debouncedSessionId],
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setLoadError(null);

      try {
        const [assignmentsRes, submissionsRes] = await Promise.all([
          listAssignments(queryArgs),
          // Pull submissions for this filter scope to derive per-assignment "submitted" status.
          listSubmissions({
            limit: 200,
            offset: 0,
            sortBy: "created_at",
            sortDir: "desc",
            session_id: queryArgs.session_id,
          }),
        ]);

        if (cancelled) return;

        const subByKey = new Map<string, { id: string; status: SubmissionStatus }>();
        submissionsRes.items.forEach((s) => {
          const key = `${s.session_id}:${s.employee_id}`;
          // There should be max 1 per reviewer (unique constraint); keep latest just in case.
          subByKey.set(key, { id: s.id, status: s.status });
        });

        const rows: AssignmentRow[] = assignmentsRes.items.map((a) => {
          const key = `${a.session_id}:${a.employee_id}`;
          const sub = subByKey.get(key) ?? null;
          return {
            ...a,
            derived: {
              submissionStatus: sub?.status ?? null,
              submissionId: sub?.id ?? null,
            },
          };
        });

        const filtered =
          statusFilter === ""
            ? rows
            : rows.filter((r) =>
                statusFilter === "submitted"
                  ? r.derived.submissionStatus === "submitted"
                  : r.derived.submissionStatus !== "submitted",
              );

        setItems(filtered);
        setTotal(assignmentsRes.total);
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load assignments");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [queryArgs, statusFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="crud-toolbar">
        <div className="crud-filters">
          <label className="field">
            <span className="field-label">Session ID</span>
            <input
              className="input"
              placeholder="Optional UUID filter…"
              value={sessionId}
              onChange={(e) => {
                setOffset(0);
                setSessionId(e.target.value);
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setOffset(0);
                setStatusFilter(e.target.value as "" | "pending" | "submitted");
              }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
            </select>
          </label>
        </div>

        <div className="crud-actions">
          <button
            className="button"
            type="button"
            onClick={() => {
              // Trigger reload by resetting offset to same value (no-op). We rely on effect deps.
              setOffset((o) => o);
            }}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {loadError ? <InlineAlert kind="error">{loadError}</InlineAlert> : null}

      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>
                <SortHeader
                  label="Created"
                  active={sortBy === "created_at"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(
                      sortBy === "created_at" ? (sortDir === "asc" ? "desc" : "asc") : "desc",
                    );
                    setSortBy("created_at");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Status"
                  active={sortBy === "status"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "status" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("status");
                  }}
                />
              </th>
              <th>Session</th>
              <th>Employee</th>
              <th style={{ width: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No assignments found.
                </td>
              </tr>
            ) : (
              items.map((a) => {
                const isSubmitted = a.derived.submissionStatus === "submitted";
                return (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                    <td>{statusBadge(isSubmitted ? "submitted" : "pending")}</td>
                    <td className="muted small" style={{ maxWidth: 280 }}>
                      {a.session_id}
                    </td>
                    <td className="muted small" style={{ maxWidth: 280 }}>
                      {a.employee_id}
                    </td>
                    <td>
                      <div className="crud-actions">
                        <Link className="button button-primary" href={`/assignments/detail?id=${encodeURIComponent(a.id)}`}>
                          {isSubmitted ? "View submission" : "Start / Continue"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        total={total}
        limit={limit}
        offset={offset}
        onChange={({ limit: nextLimit, offset: nextOffset }) => {
          setLimit(nextLimit);
          setOffset(nextOffset);
        }}
      />

      <div className="muted small">
        Note: this list is scoped to your reviewer account by the backend. Session/employee names are not
        returned by the API yet, so IDs are shown.
      </div>
    </div>
  );
}
