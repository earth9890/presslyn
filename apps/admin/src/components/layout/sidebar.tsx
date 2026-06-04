"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarLeft01Icon, SidebarRightIcon } from "hugeicons-react";
import { NAV_SECTIONS } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <aside
      aria-label="Main navigation"
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-text",
        "w-[212px] border-r border-white/6 lg:w-full"
      )}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="rounded-2xl border border-white/6 bg-white/[0.04] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-icon">
            Presslyn Admin
          </p>
          <p className="mt-1 text-[13px] leading-5 text-sidebar-text">
            Editorial control, cleaner than legacy CMS chrome.
          </p>
        </div>
      </div>

      <nav aria-label="Admin menu" className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-5 last:mb-0">
            <ul className="m-0 list-none px-0">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href} className="my-1">
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex min-h-11 items-center rounded-2xl border px-3 text-[13px] leading-5 transition-all duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                        active
                          ? "border-white/8 bg-sidebar-active text-sidebar-text-active shadow-[inset_0_0_0_1px_var(--presslyn-accent-glow)]"
                          : "border-transparent text-sidebar-text hover:border-white/6 hover:bg-sidebar-hover hover:text-sidebar-text-active"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-icon transition-colors",
                          active && "text-accent"
                        )}
                      >
                        <Icon size={18} />
                      </span>
                      <span
                        className={cn(
                          "truncate pl-2.5",
                          collapsed ? "lg:hidden" : "block"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mx-3 mb-3 hidden h-10 items-center rounded-2xl border border-white/6 bg-white/[0.03] px-3 text-[12px] text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-text-active lg:flex",
          collapsed ? "justify-center" : "gap-2"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <SidebarRightIcon size={14} /> : <SidebarLeft01Icon size={14} />}
        {!collapsed ? <span>Condense</span> : null}
      </button>
    </aside>
  );

  return (
    <>
      <div
        className={cn(
          "fixed left-0 top-11 z-40 hidden h-[calc(100vh-2.75rem)] transition-[width] duration-150 lg:block",
          collapsed ? "w-[84px]" : "w-[212px]"
        )}
      >
        {sidebarContent}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 top-11 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={onMobileClose}
            aria-label="Close navigation menu"
          />
          <div className="relative h-full w-[212px] shadow-[0_24px_48px_rgba(15,23,42,0.28)]">
            {sidebarContent}
          </div>
        </div>
      ) : null}
    </>
  );
}
