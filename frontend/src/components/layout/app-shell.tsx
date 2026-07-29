"use client";

import * as React from "react";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { AppTopbar } from "@/components/layout/app-topbar";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { ROLE_LABEL } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/auth";

const SIDEBAR_STORAGE_KEY = "cgs-lms-sidebar-collapsed";

interface AppShellProps {
  role: AppRole;
  profileHref: string;
  children: React.ReactNode;
}

export function AppShell({ role, profileHref, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      // Prefer reading after mount to avoid a server/client mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden border-r border-border bg-background transition-[width,transform] duration-200 ease-out md:block",
          collapsed ? "w-0 -translate-x-full overflow-hidden border-transparent" : "w-64 translate-x-0",
          !hydrated && "transition-none",
        )}
        aria-hidden={collapsed}
      >
        <AppSidebarNav navItems={NAV_ITEMS[role]} roleLabel={ROLE_LABEL[role]} />
      </aside>

      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "md:pl-0" : "md:pl-64",
          !hydrated && "transition-none",
        )}
      >
        <AppTopbar
          role={role}
          profileHref={profileHref}
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
