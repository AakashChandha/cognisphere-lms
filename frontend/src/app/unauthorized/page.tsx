"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { getHomePathForRoles } from "@/lib/constants/roles";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const homeHref = user ? getHomePathForRoles(user.roles) : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. If you believe this is a mistake, contact your
          administrator.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href={homeHref} />}>
          Go to dashboard
        </Button>
        {user ? (
          <Button variant="ghost" onClick={() => void logout()}>
            Log out
          </Button>
        ) : null}
      </div>
    </div>
  );
}
