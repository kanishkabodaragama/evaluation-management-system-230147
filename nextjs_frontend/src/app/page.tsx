"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRole } from "@/components/auth/useRole";

export default function Home() {
  const router = useRouter();
  const { session, isAuthLoading } = useAuth();
  const roleState = useRole();

  useEffect(() => {
    if (isAuthLoading) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    if (roleState.status !== "ready") return;

    router.replace(roleState.role === "reviewer" ? "/assignments" : "/dashboard");
  }, [isAuthLoading, session, roleState.status, roleState.role, router]);

  return (
    <main className="page">
      <div className="card">
        <h1 className="page-title">Loading</h1>
        <p className="muted">Preparing your workspace…</p>
      </div>
    </main>
  );
}
