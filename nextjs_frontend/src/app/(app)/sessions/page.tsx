"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Page } from "@/components/ui/Page";

export default function SessionsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <Page title="Sessions" description="Create and manage review sessions.">
        <p className="muted">
          No sessions loaded yet. Add session lifecycle and assignment workflow here.
        </p>
      </Page>
    </RequireAuth>
  );
}
