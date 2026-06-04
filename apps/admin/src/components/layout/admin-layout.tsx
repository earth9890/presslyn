"use client";

import Link from "next/link";
import {
  HelpCircleIcon,
  Cancel01Icon,
  ViewIcon,
  InformationCircleIcon,
} from "hugeicons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DEFAULT_ITEMS_PER_PAGE,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  getAdminPageKey,
  getAdminScreenConfig,
  type AdminColorSchemeId,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const SIDEBAR_COLLAPSED_KEY = "presslyn_sidebar_collapsed";
const COLOR_SCHEME_KEY = "presslyn_admin_color_scheme";
const SCREEN_PREFS_KEY = "presslyn_admin_screen_preferences";
const DISMISSED_NOTICES_KEY = "presslyn_admin_dismissed_notices";

type ActivePanel = "screen-options" | "help" | null;

interface ScreenPreferences {
  showDescription: boolean;
  denseTables: boolean;
  hiddenColumns: Record<string, string[]>;
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

const DEFAULT_PREFERENCES: ScreenPreferences = {
  showDescription: true,
  denseTables: false,
  hiddenColumns: {},
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageKey = useMemo(() => getAdminPageKey(pathname), [pathname]);
  const screenConfig = useMemo(
    () => getAdminScreenConfig(pathname),
    [pathname]
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [colorScheme, setColorScheme] =
    useState<AdminColorSchemeId>("default");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [screenPreferences, setScreenPreferences] =
    useState<ScreenPreferences>(DEFAULT_PREFERENCES);
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(String(DEFAULT_ITEMS_PER_PAGE));

  const hiddenColumns = screenPreferences.hiddenColumns[pageKey] ?? [];

  useEffect(() => {
    try {
      const storedSidebar = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      const storedScheme = localStorage.getItem(COLOR_SCHEME_KEY);
      const storedPreferences = localStorage.getItem(SCREEN_PREFS_KEY);
      const storedDismissedNotices = localStorage.getItem(
        DISMISSED_NOTICES_KEY
      );

      if (storedSidebar === "true") {
        setSidebarCollapsed(true);
      }

      if (storedScheme) {
        setColorScheme(storedScheme as AdminColorSchemeId);
      }

      if (storedPreferences) {
        setScreenPreferences({
          ...DEFAULT_PREFERENCES,
          ...JSON.parse(storedPreferences),
        });
      }

      if (storedDismissedNotices) {
        setDismissedNotices(JSON.parse(storedDismissedNotices));
      }
    } catch {
      // Ignore storage read failures and continue with defaults.
    }
  }, []);

  useEffect(() => {
    const queryValue =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("perPage");
    const fallback = screenConfig.supportsItemsPerPage
      ? queryValue ?? String(DEFAULT_ITEMS_PER_PAGE)
      : String(DEFAULT_ITEMS_PER_PAGE);

    setItemsPerPage(fallback);
    setActivePanel(null);
  }, [pathname, screenConfig.supportsItemsPerPage]);

  const persistPreferences = useCallback((next: ScreenPreferences) => {
    setScreenPreferences(next);

    try {
      localStorage.setItem(SCREEN_PREFS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const persistDismissedNotices = useCallback((next: string[]) => {
    setDismissedNotices(next);

    try {
      localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => {
      const next = !previous;

      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage write failures.
      }

      return next;
    });
  }, []);

  const handleColorSchemeChange = useCallback((scheme: AdminColorSchemeId) => {
    setColorScheme(scheme);

    try {
      localStorage.setItem(COLOR_SCHEME_KEY, scheme);
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const toggleHiddenColumn = useCallback(
    (columnKey: string) => {
      const currentColumns = screenPreferences.hiddenColumns[pageKey] ?? [];
      const nextColumns = currentColumns.includes(columnKey)
        ? currentColumns.filter((value) => value !== columnKey)
        : [...currentColumns, columnKey];

      persistPreferences({
        ...screenPreferences,
        hiddenColumns: {
          ...screenPreferences.hiddenColumns,
          [pageKey]: nextColumns,
        },
      });
    },
    [pageKey, persistPreferences, screenPreferences]
  );

  const togglePreference = useCallback(
    (key: "showDescription" | "denseTables") => {
      persistPreferences({
        ...screenPreferences,
        [key]: !screenPreferences[key],
      });
    },
    [persistPreferences, screenPreferences]
  );

  const dismissNotice = useCallback(
    (noticeId: string) => {
      if (dismissedNotices.includes(noticeId)) {
        return;
      }

      persistDismissedNotices([...dismissedNotices, noticeId]);
    },
    [dismissedNotices, persistDismissedNotices]
  );

  const handleItemsPerPageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setItemsPerPage(event.target.value);
  };

  const applyScreenOptions = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!screenConfig.supportsItemsPerPage) {
      return;
    }

    const parsed = Number(itemsPerPage);
    const normalized = Number.isFinite(parsed)
      ? Math.min(200, Math.max(1, parsed))
      : DEFAULT_ITEMS_PER_PAGE;

    const params = new URLSearchParams(window.location.search);
    params.set("perPage", String(normalized));

    if (params.has("page")) {
      params.set("page", "1");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const currentNotice =
    screenConfig.notice &&
    !dismissedNotices.includes(screenConfig.notice.id)
      ? screenConfig.notice
      : null;

  const hiddenColumnCss = hiddenColumns
    .map(
      (columnKey) =>
        `[data-admin-page="${pageKey}"] [data-column="${columnKey}"] { display: none !important; }`
    )
    .join("\n");

  return (
    <div
      data-admin-scheme={colorScheme}
      data-admin-page={pageKey}
      className="min-h-screen bg-admin-content"
    >
      <Topbar
        onMenuToggle={() => setMobileMenuOpen((previous) => !previous)}
        colorScheme={colorScheme}
        onColorSchemeChange={handleColorSchemeChange}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <style>{`
        @media (min-width: 1024px) {
          .presslyn-admin-main {
            margin-left: ${
              sidebarCollapsed
                ? SIDEBAR_WIDTH_COLLAPSED
                : SIDEBAR_WIDTH_EXPANDED
            }px;
          }
        }

        ${hiddenColumnCss}
      `}</style>

      <div className="presslyn-admin-main pt-11">
        <div className="border-b border-border/80 bg-surface/78 backdrop-blur-sm">
          <div className="flex min-h-[112px] flex-col justify-between gap-5 px-5 py-6 lg:flex-row lg:items-start lg:px-8">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center rounded-full border border-accent/15 bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Presslyn control surface
              </div>
              <h1 className="text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                {screenConfig.title}
              </h1>
              {screenPreferences.showDescription ? (
                <p className="mt-3 max-w-3xl text-[14px] leading-6 text-text-secondary">
                  {screenConfig.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {screenConfig.primaryAction ? (
                <Link
                  href={screenConfig.primaryAction.href}
                  className="inline-flex h-10 items-center rounded-2xl border border-accent bg-accent px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_var(--presslyn-accent-glow)] transition-colors hover:bg-accent-hover"
                >
                  {screenConfig.primaryAction.label}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((previous) =>
                    previous === "screen-options" ? null : "screen-options"
                  )
                }
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary",
                  activePanel === "screen-options"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface"
                )}
              >
                <ViewIcon size={14} />
                <span>Screen Options</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setActivePanel((previous) =>
                    previous === "help" ? null : "help"
                  )
                }
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary",
                  activePanel === "help"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface"
                )}
              >
                <HelpCircleIcon size={14} />
                <span>Help</span>
              </button>
            </div>
          </div>

          {activePanel === "screen-options" ? (
            <form
              onSubmit={applyScreenOptions}
              className="grid gap-6 border-t border-border bg-surface-raised/86 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:px-8"
            >
              <div className="grid gap-5 lg:grid-cols-3">
                <section className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                    Layout
                  </h2>
                  <label className="mt-4 flex items-center gap-2.5 text-[13px] text-text-secondary">
                    <input
                      type="checkbox"
                      checked={screenPreferences.showDescription}
                      onChange={() => togglePreference("showDescription")}
                      className="h-4 w-4 rounded-md border-border text-accent focus:ring-accent"
                    />
                    <span>Show page context</span>
                  </label>
                  <label className="mt-3 flex items-center gap-2.5 text-[13px] text-text-secondary">
                    <input
                      type="checkbox"
                      checked={screenPreferences.denseTables}
                      onChange={() => togglePreference("denseTables")}
                      className="h-4 w-4 rounded-md border-border text-accent focus:ring-accent"
                    />
                    <span>Use tighter lists</span>
                  </label>
                </section>

                {screenConfig.columnOptions?.length ? (
                  <section className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Columns
                    </h2>
                    <div className="mt-4 space-y-3">
                      {screenConfig.columnOptions.map((option) => (
                        <label
                          key={option.key}
                          className="flex items-center gap-2.5 text-[13px] text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.includes(option.key)}
                            onChange={() => toggleHiddenColumn(option.key)}
                            className="h-4 w-4 rounded-md border-border text-accent focus:ring-accent"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                ) : null}

                {screenConfig.supportsItemsPerPage ? (
                  <section className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Pagination
                    </h2>
                    <label className="mt-4 block text-[13px] text-text-secondary">
                      Items per page
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={itemsPerPage}
                      onChange={handleItemsPerPageChange}
                      className="mt-3 h-11 w-28 rounded-2xl border border-border bg-surface-raised px-3 text-[13px] text-text-primary outline-none transition-colors focus:border-accent"
                    />
                  </section>
                ) : null}
              </div>

              {screenConfig.supportsItemsPerPage ? (
                <div className="flex items-end justify-start lg:justify-end">
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-2xl border border-accent bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    Apply
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {activePanel === "help" ? (
            <div className="grid gap-4 border-t border-border bg-surface-raised/86 px-5 py-5 lg:grid-cols-2 lg:px-8">
              {screenConfig.helpSections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-border bg-surface px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
                >
                  <h2 className="text-[14px] font-semibold text-text-primary">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-[13px] leading-5 text-text-secondary">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          ) : null}
        </div>

        {currentNotice ? (
          <div className="px-5 pt-5 lg:px-8">
            <div
              className={cn(
                "flex items-start justify-between gap-4 overflow-hidden rounded-[1.35rem] border px-5 py-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]",
                currentNotice.tone === "success" &&
                  "border-success/18 bg-[rgba(15,159,110,0.08)]",
                currentNotice.tone === "info" &&
                  "border-accent/18 bg-[rgba(37,99,235,0.08)]",
                currentNotice.tone === "warning" &&
                  "border-warning/18 bg-[rgba(217,119,6,0.08)]"
              )}
            >
              <div className="flex items-start gap-3">
                <InformationCircleIcon
                  size={18}
                  className={cn(
                    "mt-1 shrink-0",
                    currentNotice.tone === "success" && "text-success",
                    currentNotice.tone === "info" && "text-accent",
                    currentNotice.tone === "warning" && "text-warning"
                  )}
                />
                <div>
                  <p className="text-[13px] font-semibold tracking-[0.01em] text-text-primary">
                    {currentNotice.title}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-text-secondary">
                    {currentNotice.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissNotice(currentNotice.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/80 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Dismiss notice"
              >
                <Cancel01Icon size={16} />
              </button>
            </div>
          </div>
        ) : null}

        <main
          className={cn(
            "min-h-[calc(100vh-2.75rem)] px-5 py-5 lg:px-8",
            screenPreferences.denseTables && "admin-main-dense"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
