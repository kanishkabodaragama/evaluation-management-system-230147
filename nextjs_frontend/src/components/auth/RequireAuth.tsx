"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRole } from "@/components/auth/useRole";
import type { UserRole } from "@/lib/api";

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="page">
      <div className="card">
        <h1 className="page-title">{label}</h1>
        <p className="muted">Loading…</p>
      </div>
    </main>
  );
}

// PUBLIC_INTERFACE
export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  /** Client-side route guard: requires Supabase session and optional backend role. */
  const router = useRouter();
  const pathname = usePathname();
  const { session, isAuthLoading } = useAuth();
  const roleState = useRole();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthLoading, session, router, pathname]);

  if (isAuthLoading) return <LoadingScreen label="Signing you in" />;
  if (!session) return <LoadingScreen label="Redirecting to login" />;

  if (!allowedRoles) {
    // Authenticated-only guard
    return <>{children}</>;
  }

  if (roleState.status === "loading") return <LoadingScreen label="Loading your access" />;
  if (roleState.status === "error") {
    return (
      <main className="page">
        <div className="card" role="alert">
          <h1 className="page-title">Unable to load profile</h1>
          <p className="muted">{roleState.error}</p>
        </div>
      </main>
    );
  }
  if (roleState.status === "unauthenticated") return <LoadingScreen label="Redirecting to login" />;

  const role = roleState.role;
  if (!allowedRoles.includes(role)) {
    router.replace(role === "reviewer" ? "/assignments" : "/dashboard");
    return <LoadingScreen label="Redirecting" />;
  }

  return <>{children}</>;
}
