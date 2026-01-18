"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function CriteriaPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Criteria" description="Define evaluation criteria and scoring.">
        <p className="muted">
          No criteria loaded yet. Add create/edit forms and list view here.
        </p>
      </Page>
    </RequireAuth>
  );
}
