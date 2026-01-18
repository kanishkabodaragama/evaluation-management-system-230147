"use client";

import React, { useMemo } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// PUBLIC_INTERFACE
export function formatNumber(n: number | null | undefined, digits = 0): string {
  /** Format a number with grouping; returns "—" for null/undefined/NaN. */
  if (n === null || n === undefined) return "—";
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// PUBLIC_INTERFACE
export function formatPercent(n: number | null | undefined, digits = 0): string {
  /** Format as percent (expects 0-100); returns "—" for null/undefined/NaN. */
  if (n === null || n === undefined) return "—";
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

// PUBLIC_INTERFACE
export function SummaryCards({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    hint?: string;
  }>;
}) {
  /** Responsive summary card grid for top-level metrics. */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it) => (
        <div key={it.label} className="card" style={{ padding: 14 }}>
          <div className="muted small">{it.label}</div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", marginTop: 4 }}>
            {it.value}
          </div>
          {it.hint ? (
            <div className="muted small" style={{ marginTop: 6 }}>
              {it.hint}
            </div>
          ) : null}
        </div>
      ))}

      <style jsx>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 520px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

type BarDatum = { label: string; value: number | null };

// PUBLIC_INTERFACE
export function MiniBarChart({
  title,
  data,
  valueSuffix,
}: {
  title: string;
  data: BarDatum[];
  valueSuffix?: string;
}) {
  /** Lightweight bar chart using divs (no external libs, export-safe). */
  const safeValues = useMemo(
    () => data.map((d) => (d.value === null ? 0 : d.value)),
    [data],
  );
  const max = useMemo(() => Math.max(1, ...safeValues), [safeValues]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="page-title" style={{ fontSize: "1.05rem" }}>
        {title}
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        Hover bars for exact values.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {data.map((d) => {
          const v = d.value === null ? 0 : d.value;
          const pct = Math.max(0, Math.min(100, (v / max) * 100));
          const shown =
            d.value === null ? "—" : `${formatNumber(d.value, 2)}${valueSuffix ?? ""}`;

          return (
            <div key={d.label} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
              <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.label}
              </div>
              <div
                title={shown}
                style={{
                  height: 16,
                  borderRadius: 999,
                  background: "rgba(55, 65, 81, 0.08)",
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--primary)",
                    opacity: 0.9,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: 8,
                    fontSize: "0.8rem",
                    color: "rgba(17, 24, 39, 0.8)",
                  }}
                >
                  {shown}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export function CsvDownloadLink({
  label,
  href,
  disabled,
  title,
}: {
  label: string;
  href: string;
  disabled?: boolean;
  title?: string;
}) {
  /** Styled download link for CSV endpoints. Note: auth cookies are not used; backend requires Bearer token. */
  return (
    <a
      className={cx("button", disabled && "button")}
      href={disabled ? undefined : href}
      aria-disabled={disabled ? "true" : undefined}
      title={title}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      download
      style={disabled ? { opacity: 0.6, pointerEvents: "none" } : undefined}
    >
      {label}
    </a>
  );
}
