"use client";

import React, { useEffect, useMemo, useState } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// PUBLIC_INTERFACE
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  /** Debounce a value on the client to avoid refetching on every keystroke. */
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

// PUBLIC_INTERFACE
export function buildQueryString(params: Record<string, unknown>): string {
  /** Build a stable query string, skipping undefined/null/empty-string values. */
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export type SortDir = "asc" | "desc";

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// PUBLIC_INTERFACE
export function PaginationControls({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: { limit: number; offset: number }) => void;
}) {
  /** Simple pagination with Prev/Next and page size selection. */
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="crud-pagination">
      <div className="muted small">
        Page {page} of {totalPages} • {total} total
      </div>

      <div className="crud-pagination-actions">
        <label className="crud-inline">
          <span className="muted small">Rows</span>
          <select
            className="input crud-select"
            value={limit}
            onChange={(e) => {
              const nextLimit = clamp(Number(e.target.value), 1, 100);
              onChange({ limit: nextLimit, offset: 0 });
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button"
          type="button"
          disabled={!canPrev}
          onClick={() => onChange({ limit, offset: Math.max(0, offset - limit) })}
        >
          Prev
        </button>
        <button
          className="button"
          type="button"
          disabled={!canNext}
          onClick={() => onChange({ limit, offset: offset + limit })}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export function SortHeader({
  label,
  active,
  dir,
  onToggle,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
}) {
  /** Clickable sort header indicator. */
  return (
    <button
      type="button"
      className={cx("crud-sort", active && "crud-sort-active")}
      onClick={onToggle}
    >
      {label}{" "}
      <span aria-hidden="true" className="crud-sort-indicator">
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

// PUBLIC_INTERFACE
export function InlineAlert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  /** Lightweight alert variants for CRUD pages. */
  return (
    <div
      className={cx(
        "crud-alert",
        kind === "error" && "crud-alert-error",
        kind === "success" && "crud-alert-success",
        kind === "info" && "crud-alert-info",
      )}
      role={kind === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}

// PUBLIC_INTERFACE
export function ConfirmButton({
  children,
  confirmText,
  onConfirm,
  className,
  disabled,
}: {
  children: React.ReactNode;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}) {
  /** Button that uses `window.confirm` before executing a destructive action. */
  return (
    <button
      type="button"
      className={cx("button", className)}
      disabled={disabled}
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        await onConfirm();
      }}
    >
      {children}
    </button>
  );
}

// PUBLIC_INTERFACE
export function FormActions({ children }: { children: React.ReactNode }) {
  /** Consistent spacing and layout for form action rows. */
  return <div className="crud-form-actions">{children}</div>;
}

// PUBLIC_INTERFACE
export function useStableMemo<T>(factory: () => T, deps: unknown[]) {
  /** Convenience wrapper around useMemo to keep usage consistent in pages. */
  return useMemo(factory, deps);
}
