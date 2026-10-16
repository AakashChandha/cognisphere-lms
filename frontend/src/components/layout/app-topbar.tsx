"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, UserCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarToggleButton } from "@/components/layout/sidebar-toggle-button";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLE_LABEL } from "@/lib/constants/roles";
import { NAV_ITEMS } from "@/lib/constants/nav";
import { getInitials } from "@/lib/utils/format";
import type { AppRole } from "@/types/auth";

interface AppTopbarProps {
  role: AppRole;
  profileHref: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function AppTopbar({
  role,
  profileHref,
  sidebarCollapsed,
  onToggleSidebar,
}: AppTopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
      <SidebarToggleButton collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebarNav
            navItems={NAV_ITEMS[role]}
            roleLabel={ROLE_LABEL[role]}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
              <Avatar size="sm">
                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {user.firstName} {user.lastName}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(profileHref)}>
            <UserCircle />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
