"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function SubmissionsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Submissions" description="Review and manage submitted evaluations.">
        <p className="muted">
          No submissions loaded yet. Add filtering, detail views, and export actions here.
        </p>
      </Page>
    </RequireAuth>
  );
}
