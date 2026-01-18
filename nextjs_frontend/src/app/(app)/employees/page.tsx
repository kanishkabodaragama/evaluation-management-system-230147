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
import type { Employee } from "@/lib/api";
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from "@/lib/api";

type SortDir = "asc" | "desc";
type SortBy =
  | "created_at"
  | "updated_at"
  | "full_name"
  | "email"
  | "employee_code"
  | "team"
  | "title"
  | "status";

type FormState = {
  id?: string;
  employee_code: string;
  full_name: string;
  email: string;
  team: string;
  title: string;
  status: "active" | "inactive";
};

function toFormState(item?: Employee | null): FormState {
  return {
    id: item?.id,
    employee_code: item?.employee_code ?? "",
    full_name: item?.full_name ?? "",
    email: item?.email ?? "",
    team: item?.team ?? "",
    title: item?.title ?? "",
    status: item?.status ?? "active",
  };
}

function validateEmployee(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.full_name.trim()) errors.push("Full name is required.");
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.push("Email must be a valid address.");
  }
  return errors;
}

export default function EmployeesPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Employees" description="Manage employees and interns.">
        <EmployeesCrud />
      </Page>
    </RequireAuth>
  );
}

function EmployeesCrud() {
  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [teamFilter, setTeamFilter] = useState("");
  const [q, setQ] = useState("");

  const debouncedQ = useDebouncedValue(q, 350);

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Employee | null>(null);
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
      team: teamFilter ? teamFilter : undefined,
      q: debouncedQ ? debouncedQ : undefined,
    }),
    [limit, offset, sortBy, sortDir, statusFilter, teamFilter, debouncedQ],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listEmployees(queryArgs)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load employees");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryArgs]);

  function startCreate() {
    setEditing(null);
    setForm(toFormState(null));
    setFormError(null);
    setFormSuccess(null);
  }

  function startEdit(item: Employee) {
    setEditing(item);
    setForm(toFormState(item));
    setFormError(null);
    setFormSuccess(null);
  }

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listEmployees(queryArgs);
      setItems(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    setFormError(null);
    setFormSuccess(null);

    const errors = validateEmployee(form);
    if (errors.length) {
      setFormError(errors.join(" "));
      return;
    }

    setFormStatus("saving");
    try {
      if (editing) {
        await updateEmployee(editing.id, {
          employee_code: form.employee_code.trim() || null,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          team: form.team.trim() || null,
          title: form.title.trim() || null,
          status: form.status,
        });
        setFormSuccess("Employee updated.");
      } else {
        await createEmployee({
          employee_code: form.employee_code.trim() || null,
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          team: form.team.trim() || null,
          title: form.title.trim() || null,
          status: form.status,
        });
        setFormSuccess("Employee created.");
        setForm(toFormState(null));
      }

      await refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setFormStatus("idle");
    }
  }

  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((e) => {
      if (e.team) set.add(e.team);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="crud-toolbar">
        <div className="crud-filters">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="input"
              placeholder="Name, email, code…"
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
                setStatusFilter(e.target.value as "" | "active" | "inactive");
              }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Team</span>
            <input
              className="input"
              placeholder="e.g. Platform"
              list="employee-team-options"
              value={teamFilter}
              onChange={(e) => {
                setOffset(0);
                setTeamFilter(e.target.value);
              }}
            />
            <datalist id="employee-team-options">
              {teamOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="crud-actions">
          <button className="button" type="button" onClick={() => refresh()} disabled={loading}>
            Refresh
          </button>
          <button className="button button-primary" type="button" onClick={() => startCreate()}>
            New employee
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
                  active={sortBy === "full_name"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "full_name" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("full_name");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Email"
                  active={sortBy === "email"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "email" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("email");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Team"
                  active={sortBy === "team"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "team" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("team");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Title"
                  active={sortBy === "title"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "title" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("title");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Code"
                  active={sortBy === "employee_code"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(
                      sortBy === "employee_code" ? (sortDir === "asc" ? "desc" : "asc") : "asc",
                    );
                    setSortBy("employee_code");
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
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No employees found.
                </td>
              </tr>
            ) : (
              items.map((e) => (
                <tr key={e.id}>
                  <td>{e.full_name}</td>
                  <td>{e.email ?? <span className="muted">—</span>}</td>
                  <td>{e.team ?? <span className="muted">—</span>}</td>
                  <td>{e.title ?? <span className="muted">—</span>}</td>
                  <td>{e.employee_code ?? <span className="muted">—</span>}</td>
                  <td>{e.status}</td>
                  <td>
                    <div className="crud-actions">
                      <button className="button" type="button" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <ConfirmButton
                        className="button button-danger"
                        confirmText={`Delete ${e.full_name}? This cannot be undone.`}
                        onConfirm={async () => {
                          await deleteEmployee(e.id);
                          // Keep user on current page, but ensure offset still valid.
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
          {editing ? "Edit employee" : "Create employee"}
        </h2>
        <p className="muted small">
          {editing ? "Update details and save changes." : "Add a new employee to the directory."}
        </p>

        <div className="crud-form" style={{ marginTop: 10 }}>
          <label className="field">
            <span className="field-label">Full name *</span>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Doe"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@company.com"
            />
          </label>

          <label className="field">
            <span className="field-label">Team</span>
            <input
              className="input"
              value={form.team}
              onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
              placeholder="e.g. Platform"
            />
          </label>

          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Intern"
            />
          </label>

          <label className="field">
            <span className="field-label">Employee code</span>
            <input
              className="input"
              value={form.employee_code}
              onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
              placeholder="e.g. EMP-00123"
            />
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>

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
                {formStatus === "saving" ? "Saving…" : editing ? "Save changes" : "Create employee"}
              </button>
            </FormActions>
          </div>
        </div>
      </div>
    </div>
  );
}
