"use client";

import Link, { type LinkProps } from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type PropsWithChildren,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface AdminNavigationContextValue {
  isPending: boolean;
  pendingLabel: string;
  startNavigation: (label?: string) => void;
  startRefresh: (label?: string) => void;
}

const AdminNavigationContext =
  createContext<AdminNavigationContextValue | null>(null);

const MIN_PENDING_MS = 320;

interface AdminNavigationProviderProps extends PropsWithChildren {
  defaultLabel?: string;
}

export function AdminNavigationProvider({
  children,
  defaultLabel = "Loading section",
}: AdminNavigationProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const pendingSinceRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState(defaultLabel);

  const clearPendingSoon = useCallback(() => {
    if (pendingSinceRef.current === null) {
      setIsPending(false);
      return;
    }

    const elapsed = Date.now() - pendingSinceRef.current;
    const remaining = Math.max(0, MIN_PENDING_MS - elapsed);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      pendingSinceRef.current = null;
      setIsPending(false);
      timeoutRef.current = null;
    }, remaining);
  }, []);

  useEffect(() => {
    if (isPending) {
      clearPendingSoon();
    }
  }, [clearPendingSoon, isPending, routeKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const begin = useCallback(
    (label?: string) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      pendingSinceRef.current = Date.now();
      setPendingLabel(label?.trim() || defaultLabel);
      setIsPending(true);
    },
    [defaultLabel]
  );

  const value = useMemo<AdminNavigationContextValue>(
    () => ({
      isPending,
      pendingLabel,
      startNavigation: begin,
      startRefresh: begin,
    }),
    [begin, isPending, pendingLabel]
  );

  return (
    <AdminNavigationContext.Provider value={value}>
      {children}
    </AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation() {
  const context = useContext(AdminNavigationContext);
  if (!context) {
    throw new Error(
      "useAdminNavigation must be used within an AdminNavigationProvider"
    );
  }
  return context;
}

type AdminNavLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "prefetch"
> &
  LinkProps & {
    pendingLabel?: string;
    prefetchOnMount?: boolean;
  };

export function AdminNavLink({
  href,
  pendingLabel,
  prefetchOnMount = true,
  onClick,
  children,
  ...props
}: AdminNavLinkProps) {
  const router = useRouter();
  const { startNavigation } = useAdminNavigation();
  const hrefValue = typeof href === "string" ? href : href.toString();

  useEffect(() => {
    if (!prefetchOnMount) {
      return;
    }

    router.prefetch(hrefValue);
  }, [hrefValue, prefetchOnMount, router]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }

      startNavigation(pendingLabel);
    },
    [onClick, pendingLabel, startNavigation]
  );

  return (
    <Link href={href} onClick={handleClick} prefetch={prefetchOnMount} {...props}>
      {children}
    </Link>
  );
}
