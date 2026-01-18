"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";
import {
  ConfirmButton,
  FormActions,
  InlineAlert,
  PaginationControls,
  SortHeader,
  useDebouncedValue,
} from "@/components/ui/crud";
import type { ReviewSession } from "@/lib/api";
import { createSession, deleteSession, listSessions, updateSession } from "@/lib/api";

type SortDir = "asc" | "desc";
type SortBy = "created_at" | "updated_at" | "name" | "status" | "start_date" | "end_date";

type FormState = {
  id?: string;
  name: string;
  description: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: "draft" | "active" | "closed" | "archived";
};

function toFormState(item?: ReviewSession | null): FormState {
  return {
    id: item?.id,
    name: item?.name ?? "",
    description: item?.description ?? "",
    start_date: item?.start_date ?? "",
    end_date: item?.end_date ?? "",
    status: item?.status ?? "draft",
  };
}

function validate(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Name is required.");
  if (form.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.start_date)) {
    errors.push("Start date must be in YYYY-MM-DD format.");
  }
  if (form.end_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.end_date)) {
    errors.push("End date must be in YYYY-MM-DD format.");
  }
  if (form.start_date && form.end_date && form.start_date > form.end_date) {
    errors.push("End date cannot be before start date.");
  }
  return errors;
}

export default function SessionsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Sessions" description="Create and manage review sessions.">
        <SessionsCrud />
      </Page>
    </RequireAuth>
  );
}

function SessionsCrud() {
  const [items, setItems] = useState<ReviewSession[]>([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [statusFilter, setStatusFilter] = useState<
    "" | "draft" | "active" | "closed" | "archived"
  >("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ReviewSession | null>(null);
  const [form, setForm] = useState<FormState>(() => toFormState(null));
  const [formStatus, setFormStatus] = useState<"idle" | "saving">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const queryArgs = useMemo(
    () => ({
      limit,
      offset,
      sortBy,
      sortDir,
      status: statusFilter ? statusFilter : undefined,
      q: debouncedQ ? debouncedQ : undefined,
    }),
    [limit, offset, sortBy, sortDir, statusFilter, debouncedQ],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listSessions(queryArgs)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load sessions");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryArgs]);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listSessions(queryArgs);
      setItems(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditing(null);
    setForm(toFormState(null));
    setFormError(null);
    setFormSuccess(null);
  }

  function startEdit(item: ReviewSession) {
    setEditing(item);
    setForm(toFormState(item));
    setFormError(null);
    setFormSuccess(null);
  }

  async function onSubmit() {
    setFormError(null);
    setFormSuccess(null);

    const errors = validate(form);
    if (errors.length) {
      setFormError(errors.join(" "));
      return;
    }

    setFormStatus("saving");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date.trim() || null,
        end_date: form.end_date.trim() || null,
        status: form.status,
      };

      if (editing) {
        await updateSession(editing.id, payload);
        setFormSuccess("Session updated.");
      } else {
        await createSession(payload);
        setFormSuccess("Session created.");
        setForm(toFormState(null));
      }

      await refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save session");
    } finally {
      setFormStatus("idle");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="crud-toolbar">
        <div className="crud-filters">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="input"
              placeholder="Name…"
              value={q}
              onChange={(e) => {
                setOffset(0);
                setQ(e.target.value);
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
                setStatusFilter(e.target.value as "" | "draft" | "active" | "closed" | "archived");
              }}
            >
              <option value="">All</option>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <div className="crud-actions">
          <button className="button" type="button" onClick={() => refresh()} disabled={loading}>
            Refresh
          </button>
          <button className="button button-primary" type="button" onClick={() => startCreate()}>
            New session
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
                  label="Name"
                  active={sortBy === "name"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "name" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("name");
                  }}
                />
              </th>
              <th>Description</th>
              <th>
                <SortHeader
                  label="Start"
                  active={sortBy === "start_date"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(
                      sortBy === "start_date" ? (sortDir === "asc" ? "desc" : "asc") : "desc",
                    );
                    setSortBy("start_date");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="End"
                  active={sortBy === "end_date"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(
                      sortBy === "end_date" ? (sortDir === "asc" ? "desc" : "asc") : "desc",
                    );
                    setSortBy("end_date");
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
              <th style={{ width: 210 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No sessions found.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.description ?? <span className="muted">—</span>}</td>
                  <td>{s.start_date ?? <span className="muted">—</span>}</td>
                  <td>{s.end_date ?? <span className="muted">—</span>}</td>
                  <td>{s.status}</td>
                  <td>
                    <div className="crud-actions">
                      <button className="button" type="button" onClick={() => startEdit(s)}>
                        Edit
                      </button>
                      <ConfirmButton
                        className="button button-danger"
                        confirmText={`Delete session "${s.name}"? This cannot be undone.`}
                        onConfirm={async () => {
                          await deleteSession(s.id);
                          const nextOffset = Math.min(offset, Math.max(0, total - 1 - limit));
                          setOffset(nextOffset);
                          await refresh();
                        }}
                      >
                        Delete
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))
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

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <h2 className="page-title" style={{ fontSize: "1.05rem" }}>
          {editing ? "Edit session" : "Create session"}
        </h2>
        <p className="muted small">
          Sessions control lifecycle and grouping for assignments/submissions.
        </p>

        <div className="crud-form" style={{ marginTop: 10 }}>
          <label className="field crud-span-2">
            <span className="field-label">Name *</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 2026 H1 Intern Review"
              required
            />
          </label>

          <label className="field crud-span-2">
            <span className="field-label">Description</span>
            <textarea
              className="input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes…"
              rows={3}
            />
          </label>

          <label className="field">
            <span className="field-label">Start date</span>
            <input
              className="input"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">End date</span>
            <input
              className="input"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as "draft" | "active" | "closed" | "archived",
                }))
              }
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
              <option value="archived">archived</option>
            </select>
          </label>

          <div className="field">
            <span className="field-label">Guidance</span>
            <div className="muted small">
              Tip: keep sessions in <b>draft</b> until criteria and employees are ready. Use{" "}
              <b>active</b> when reviewers should start work.
            </div>
          </div>

          <div className="crud-span-2" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {formError ? <InlineAlert kind="error">{formError}</InlineAlert> : null}
            {formSuccess ? <InlineAlert kind="success">{formSuccess}</InlineAlert> : null}

            <FormActions>
              {editing ? (
                <button className="button" type="button" onClick={() => startCreate()}>
                  Cancel edit
                </button>
              ) : null}

              <button
                className="button button-primary"
                type="button"
                onClick={() => onSubmit()}
                disabled={formStatus === "saving"}
              >
                {formStatus === "saving" ? "Saving…" : editing ? "Save changes" : "Create session"}
              </button>
            </FormActions>
          </div>
        </div>
      </div>
    </div>
  );
}
