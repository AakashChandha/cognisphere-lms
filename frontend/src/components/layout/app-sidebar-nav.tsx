"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/constants/nav";

interface AppSidebarNavProps {
  navItems: NavItem[];
  roleLabel: string;
  onNavigate?: () => void;
}

export function AppSidebarNav({ navItems, roleLabel, onNavigate }: AppSidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label="Cognisphere LMS home"
          className="press-subtle -mx-2 flex rounded-xl px-2 py-1.5 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="md" subtitle={roleLabel} />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                // Rows highlight on pointer-down, not on release.
                "press-subtle relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground active:bg-sidebar-accent",
              )}
            >
              <Icon className={cn("size-4.5 shrink-0", isActive && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        &copy; {new Date().getFullYear()} Cognisphere
        <br />
        Management and Consultancy
      </div>
    </div>
  );
}
