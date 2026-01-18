"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function DashboardPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page
        title="Dashboard"
        description="Overview of current review activity and system health."
      >
        <p className="muted">
          No metrics loaded yet. This page will show key stats (active sessions,
          completion rate, pending submissions).
        </p>
      </Page>
    </RequireAuth>
  );
}
