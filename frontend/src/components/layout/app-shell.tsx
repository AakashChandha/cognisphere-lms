import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { AppTopbar } from "@/components/layout/app-topbar";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { ROLE_LABEL } from "@/lib/constants/roles";
import type { AppRole } from "@/types/auth";

interface AppShellProps {
  role: AppRole;
  profileHref: string;
  children: React.ReactNode;
}

export function AppShell({ role, profileHref, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-background md:block">
        <AppSidebarNav navItems={NAV_ITEMS[role]} roleLabel={ROLE_LABEL[role]} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <AppTopbar role={role} profileHref={profileHref} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
