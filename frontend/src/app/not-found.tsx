"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { getHomePathForRoles } from "@/lib/constants/roles";

export default function NotFound() {
  const { user } = useAuth();
  const homeHref = user ? getHomePathForRoles(user.roles) : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Compass className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href={homeHref} />}>
        Go back home
      </Button>
    </div>
  );
}
