"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/api";
import { fetchMe } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

type RoleState =
  | { status: "loading"; role: null; error: null }
  | { status: "ready"; role: UserRole; error: null }
  | { status: "error"; role: null; error: string }
  | { status: "unauthenticated"; role: null; error: null };

// PUBLIC_INTERFACE
export function useRole(): RoleState {
  /** Derive user role by calling backend /me with Supabase JWT forwarded. */
  const { session, isAuthLoading } = useAuth();
  const [state, setState] = useState<RoleState>({
    status: "loading",
    role: null,
    error: null,
  });

  useEffect(() => {
    if (isAuthLoading) return;

    if (!session) {
      setState({ status: "unauthenticated", role: null, error: null });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", role: null, error: null });

    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setState({ status: "ready", role: me.role, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState({ status: "error", role: null, error: msg });
      });

    return () => {
      cancelled = true;
    };
  }, [session, isAuthLoading]);

  return state;
}
