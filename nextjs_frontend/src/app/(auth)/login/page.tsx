"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRole } from "@/components/auth/useRole";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next"), [params]);

  const { session, isAuthLoading } = useAuth();
  const roleState = useRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    // Already logged in: route based on role (or to ?next=)
    if (session && roleState.status === "ready") {
      if (next) {
        router.replace(next);
      } else {
        router.replace(roleState.role === "reviewer" ? "/assignments" : "/dashboard");
      }
    }
  }, [isAuthLoading, session, roleState.status, roleState.role, router, next]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <header className="auth-header">
          <h1 className="auth-title">Sign in</h1>
          <p className="muted">
            Use your email and password to access the evaluation platform.
          </p>
        </header>

        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setStatus("loading");
            try {
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (signInError) throw signInError;
              setStatus("success");
              // Redirect will happen from the effect once role is loaded.
            } catch (err: unknown) {
              setStatus("error");
              setError(err instanceof Error ? err.message : "Unable to sign in");
            }
          }}
        >
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <div className="alert" role="alert">
              {error}
            </div>
          ) : null}

          <button className="button button-primary" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Signing in…" : "Sign in"}
          </button>

          <div className="muted small">
            Need access? Ask an administrator to create/enable your account in Supabase.
          </div>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card">
            <h1 className="auth-title">Sign in</h1>
            <p className="muted">Loading…</p>
          </div>
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
