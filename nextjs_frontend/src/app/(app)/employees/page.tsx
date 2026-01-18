"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function EmployeesPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Employees" description="Manage employees and interns.">
        <p className="muted">
          No employees loaded yet. Add client-side fetching and table view here.
        </p>
      </Page>
    </RequireAuth>
  );
}
