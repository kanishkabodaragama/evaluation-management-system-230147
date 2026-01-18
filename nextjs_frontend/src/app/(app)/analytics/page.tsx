"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function AnalyticsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Analytics" description="Trends, distributions, and exports.">
        <p className="muted">
          No analytics loaded yet. Add charts/tables using client-side data fetching from /api/analytics.
        </p>
      </Page>
    </RequireAuth>
  );
}
