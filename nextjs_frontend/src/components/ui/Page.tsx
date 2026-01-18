"use client";

import React from "react";

// PUBLIC_INTERFACE
export function Page({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  /** Standard page wrapper used across placeholder pages. */
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description muted">{description}</p> : null}
      </header>

      <section className="card">{children ?? <p className="muted">No data yet.</p>}</section>
    </main>
  );
}
