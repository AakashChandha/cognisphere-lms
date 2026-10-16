"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthLayout } from "@/components/layout/auth-layout";
import { FullPageSpinner } from "@/components/shared/full-page-spinner";
import { authApi } from "@/lib/api/auth.api";
import { useAuth } from "@/lib/auth/auth-context";
import { getHomePathForRoles } from "@/lib/constants/roles";
import { ApiError } from "@/types/api";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter the temporary password you signed in with"),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Type the new password again"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The two passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password that is different from the temporary one",
    path: ["newPassword"],
  });

type Values = z.infer<typeof schema>;

/** Shown once after an admin issues a temporary password; the role layouts redirect here until it is changed. */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isLoading, refreshUser, logout } = useAuth();
  const [showNew, setShowNew] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.mustChangePassword) {
      router.replace(getHomePathForRoles(user.roles));
    }
  }, [isLoading, user, router]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: async () => {
      await refreshUser();
      if (user) router.replace(getHomePathForRoles(user.roles));
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't change the password. Please try again.");
    },
  });

  if (isLoading || !user || !user.mustChangePassword) return <FullPageSpinner />;

  return (
    <AuthLayout title={`Welcome, ${user.firstName}`} description="Choose your own password before you continue">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            setFormError(null);
            mutation.mutate(values);
          })}
          className="space-y-4"
        >
          {formError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" autoFocus {...field} />
                </FormControl>
                <FormDescription>The one your administrator gave you.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showNew ? "text" : "password"} autoComplete="new-password" className="pr-9" {...field} />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                      aria-label={showNew ? "Hide password" : "Show password"}
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormDescription>At least 8 characters. A short sentence you will remember works well.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type={showNew ? "text" : "password"} autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save password and continue
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => void logout()}>
            Sign out instead
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
