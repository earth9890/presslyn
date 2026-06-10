"use client";

import { useEffect, useRef } from "react";
import {
  Menu01Icon,
  Notification02Icon,
  Logout03Icon,
  PaintBoardIcon,
  UserCircleIcon,
} from "hugeicons-react";
import {
  ADMIN_COLOR_SCHEMES,
  type AdminColorSchemeId,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { AdminNavLink } from "./admin-navigation";

interface TopbarProps {
  onMenuToggle?: () => void;
  colorScheme: AdminColorSchemeId;
  onColorSchemeChange: (scheme: AdminColorSchemeId) => void;
}

export function Topbar({
  onMenuToggle,
  colorScheme,
  onColorSchemeChange,
}: TopbarProps) {
  const accountMenuRef = useRef<HTMLDetailsElement>(null);

  // Close the account disclosure on Escape or an outside click.
  useEffect(() => {
    function closeMenu() {
      if (accountMenuRef.current) accountMenuRef.current.open = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    function onPointerDown(e: MouseEvent) {
      const el = accountMenuRef.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) {
        closeMenu();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const handleLogout = async () => {
    // The session cookie is HttpOnly, so it must be cleared server-side.
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Even if the request fails, fall through to the login redirect.
    }
    window.location.assign("/login");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-11 border-b border-admin-bar-border bg-admin-bar/95 text-admin-bar-text backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {onMenuToggle ? (
            <button
              onClick={onMenuToggle}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-admin-bar-text transition-colors hover:bg-admin-bar-hover hover:text-admin-bar-text-active lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu01Icon size={18} />
            </button>
          ) : null}

          <AdminNavLink
            href="/"
            pendingLabel="Opening Dashboard"
            className="hidden h-8 items-center rounded-xl px-3 text-[13px] font-semibold tracking-[0.01em] text-admin-bar-text transition-colors hover:bg-admin-bar-hover hover:text-admin-bar-text-active sm:flex"
          >
            Presslyn
          </AdminNavLink>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center rounded-xl px-3 text-[13px] text-admin-bar-text transition-colors hover:bg-admin-bar-hover hover:text-admin-bar-text-active md:flex"
          >
            Visit Site
          </a>
          <AdminNavLink
            href="/comments"
            pendingLabel="Opening Comments"
            className="hidden h-8 items-center gap-1 rounded-xl px-3 text-[13px] text-admin-bar-text transition-colors hover:bg-admin-bar-hover hover:text-admin-bar-text-active lg:flex"
          >
            <Notification02Icon size={14} />
            <span>Comments</span>
          </AdminNavLink>
        </div>

        <div className="flex items-center">
          <label
            className={cn(
              "hidden h-8 items-center gap-2 rounded-xl px-3 text-[12px] text-admin-bar-text lg:flex"
            )}
          >
            <PaintBoardIcon size={14} />
            <span>Scheme</span>
            <select
              value={colorScheme}
              onChange={(event) =>
                onColorSchemeChange(event.target.value as AdminColorSchemeId)
              }
              className="h-7 rounded-lg border border-white/10 bg-white/6 px-2 text-[12px] text-admin-bar-text outline-none transition-colors focus:border-accent"
              aria-label="Admin color scheme"
            >
              {ADMIN_COLOR_SCHEMES.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.label}
                </option>
              ))}
            </select>
          </label>

          <details ref={accountMenuRef} className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-xl border border-transparent px-3 text-[13px] text-admin-bar-text transition-colors hover:border-white/8 hover:bg-admin-bar-hover hover:text-admin-bar-text-active">
              <UserCircleIcon size={16} />
              <span className="hidden sm:inline">Admin</span>
            </summary>
            <div className="absolute right-0 top-10 z-50 min-w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_48px_rgba(15,23,42,0.18)]">
              <div className="bg-accent-soft px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  Signed in as
                </p>
                <p className="mt-1 text-[14px] font-semibold text-text-primary">
                  Admin
                </p>
              </div>
              <div className="border-b border-border px-4 py-4 lg:hidden">
                <label className="block text-[12px] font-medium text-text-secondary">
                  Color scheme
                </label>
                <select
                  value={colorScheme}
                  onChange={(event) =>
                    onColorSchemeChange(
                      event.target.value as AdminColorSchemeId
                    )
                  }
                  className="mt-2 h-10 w-full rounded-xl border border-border bg-surface-raised px-3 text-[13px] text-text-primary outline-none transition-colors focus:border-accent"
                >
                  {ADMIN_COLOR_SCHEMES.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.label}
                    </option>
                  ))}
                </select>
              </div>
              <AdminNavLink
                href="/profile"
                pendingLabel="Loading your profile…"
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
              >
                <UserCircleIcon size={14} />
                <span>Edit My Profile</span>
              </AdminNavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
              >
                <Logout03Icon size={14} />
                <span>Log Out</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
