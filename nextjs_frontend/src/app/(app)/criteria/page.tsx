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
} from "@/components/ui/crud";
import type { Criterion } from "@/lib/api";
import { createCriterion, deleteCriterion, listCriteria, updateCriterion } from "@/lib/api";

type SortDir = "asc" | "desc";
type SortBy = "sort_order" | "name" | "weight" | "is_active" | "created_at" | "updated_at";

type FormState = {
  id?: string;
  name: string;
  description: string;
  weight: string;
  sort_order: string;
  is_active: boolean;
};

function toFormState(item?: Criterion | null): FormState {
  return {
    id: item?.id,
    name: item?.name ?? "",
    description: item?.description ?? "",
    weight: item ? String(item.weight) : "1",
    sort_order: item ? String(item.sort_order) : "1",
    is_active: item?.is_active ?? true,
  };
}

function validate(form: FormState): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Name is required.");
  const w = Number(form.weight);
  if (!Number.isFinite(w) || w <= 0) errors.push("Weight must be a positive number.");
  const so = Number(form.sort_order);
  if (!Number.isInteger(so) || so < 0) errors.push("Sort order must be an integer (0 or greater).");
  return errors;
}

export default function CriteriaPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Criteria" description="Define evaluation criteria and scoring.">
        <CriteriaCrud />
      </Page>
    </RequireAuth>
  );
}

function CriteriaCrud() {
  const [items, setItems] = useState<Criterion[]>([]);
  const [total, setTotal] = useState(0);

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const [sortBy, setSortBy] = useState<SortBy>("sort_order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Criterion | null>(null);
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
      is_active:
        activeFilter === "" ? undefined : activeFilter === "true" ? true : false,
    }),
    [limit, offset, sortBy, sortDir, activeFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    listCriteria(queryArgs)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load criteria");
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
      const res = await listCriteria(queryArgs);
      setItems(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load criteria");
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

  function startEdit(item: Criterion) {
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
        weight: Number(form.weight),
        sort_order: Number(form.sort_order),
        is_active: form.is_active,
      };

      if (editing) {
        await updateCriterion(editing.id, payload);
        setFormSuccess("Criterion updated.");
      } else {
        await createCriterion(payload);
        setFormSuccess("Criterion created.");
        setForm(toFormState(null));
      }

      await refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save criterion");
    } finally {
      setFormStatus("idle");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="crud-toolbar">
        <div className="crud-filters">
          <label className="field">
            <span className="field-label">Active</span>
            <select
              className="input"
              value={activeFilter}
              onChange={(e) => {
                setOffset(0);
                setActiveFilter(e.target.value as "" | "true" | "false");
              }}
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </label>
        </div>

        <div className="crud-actions">
          <button className="button" type="button" onClick={() => refresh()} disabled={loading}>
            Refresh
          </button>
          <button className="button button-primary" type="button" onClick={() => startCreate()}>
            New criterion
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
                  label="Order"
                  active={sortBy === "sort_order"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "sort_order" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("sort_order");
                  }}
                />
              </th>
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
                  label="Weight"
                  active={sortBy === "weight"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "weight" ? (sortDir === "asc" ? "desc" : "asc") : "asc");
                    setSortBy("weight");
                  }}
                />
              </th>
              <th>
                <SortHeader
                  label="Active"
                  active={sortBy === "is_active"}
                  dir={sortDir}
                  onToggle={() => {
                    setOffset(0);
                    setSortDir(sortBy === "is_active" ? (sortDir === "asc" ? "desc" : "asc") : "desc");
                    setSortBy("is_active");
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
                  No criteria found.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td>{c.sort_order}</td>
                  <td>{c.name}</td>
                  <td>{c.description ?? <span className="muted">—</span>}</td>
                  <td>{c.weight}</td>
                  <td>{c.is_active ? "true" : "false"}</td>
                  <td>
                    <div className="crud-actions">
                      <button className="button" type="button" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      <ConfirmButton
                        className="button button-danger"
                        confirmText={`Delete criterion "${c.name}"? This cannot be undone.`}
                        onConfirm={async () => {
                          await deleteCriterion(c.id);
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
          {editing ? "Edit criterion" : "Create criterion"}
        </h2>
        <p className="muted small">
          {editing ? "Update a criterion used for scoring." : "Add a new criterion used for scoring."}
        </p>

        <div className="crud-form" style={{ marginTop: 10 }}>
          <label className="field">
            <span className="field-label">Name *</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Technical skills"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Weight *</span>
            <input
              className="input"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="1"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Sort order *</span>
            <input
              className="input"
              inputMode="numeric"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              placeholder="1"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Active</span>
            <select
              className="input"
              value={form.is_active ? "true" : "false"}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "true" }))}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>

          <label className="field crud-span-2">
            <span className="field-label">Description</span>
            <textarea
              className="input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional guidance for reviewers…"
              rows={3}
            />
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
                {formStatus === "saving" ? "Saving…" : editing ? "Save changes" : "Create criterion"}
              </button>
            </FormActions>
          </div>
        </div>
      </div>
    </div>
  );
}
