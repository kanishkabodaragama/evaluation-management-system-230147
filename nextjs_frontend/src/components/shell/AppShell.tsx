"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRole } from "@/components/auth/useRole";

type NavItem = {
  href: string;
  label: string;
  roles: Array<"admin" | "reviewer">;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin"] },
  { href: "/employees", label: "Employees", roles: ["admin"] },
  { href: "/criteria", label: "Criteria", roles: ["admin"] },
  { href: "/sessions", label: "Sessions", roles: ["admin"] },
  { href: "/assignments", label: "Assignments", roles: ["admin", "reviewer"] },
  { href: "/submissions", label: "Submissions", roles: ["admin"] },
  { href: "/analytics", label: "Analytics", roles: ["admin"] },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// PUBLIC_INTERFACE
export function AppShell({ children }: { children: React.ReactNode }) {
  /** Main application shell with persistent sidebar and topbar user menu. */
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const roleState = useRole();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = roleState.status === "ready" ? roleState.role : null;

  const visibleNavItems = useMemo(() => {
    if (!role) return [];
    return NAV_ITEMS.filter((i) => i.roles.includes(role));
  }, [role]);

  const userLabel = session?.user?.email ?? "User";

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-text">
            <div className="brand-title">Evaluation</div>
            <div className="brand-subtitle">Management</div>
          </div>
        </div>

        <nav className="nav">
          {roleState.status !== "ready" ? (
            <div className="nav-loading muted">Loading navigation…</div>
          ) : visibleNavItems.length === 0 ? (
            <div className="nav-loading muted">No pages available.</div>
          ) : (
            visibleNavItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx("nav-item", active && "nav-item-active")}
                >
                  {item.label}
                </Link>
              );
            })
          )}
        </nav>

        <div className="sidebar-footer muted">
          {role ? `Role: ${role}` : "Role: —"}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Evaluation Management System</div>

          <div className="topbar-actions">
            <button
              type="button"
              className="user-button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="user-pill">{userLabel}</span>
            </button>

            {menuOpen && (
              <div className="user-menu" role="menu" aria-label="User menu">
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    router.replace("/login");
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
