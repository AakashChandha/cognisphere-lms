"use client";

import Link from "next/link";
import { ShieldQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/layout/auth-layout";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password?" description="We will get you back in quickly">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <ShieldQuestion className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Password resets are handled by your training coordinator. Get in touch with them and they will
          set a temporary password for you, which you can change after signing in.
        </p>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
          <ArrowLeft className="size-4" />
          Back to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
