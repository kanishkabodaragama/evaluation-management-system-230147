"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function AssignmentsPage() {
  return (
    <RequireAuth allowedRoles={["admin", "reviewer"]}>
      <Page title="Assignments" description="Your assigned evaluations to complete.">
        <p className="muted">
          No assignments loaded yet. This page should show pending/completed assignments and link to submission flow.
        </p>
      </Page>
    </RequireAuth>
  );
}
