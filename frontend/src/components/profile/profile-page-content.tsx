"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/components/profile/profile-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { RoleBadge } from "@/components/shared/status-badge";
import { profileApi } from "@/lib/api/profile.api";
import { getInitials } from "@/lib/utils/format";
import type { AppRole } from "@/types/auth";

export function ProfilePageContent({
  role,
  showExpertise = false,
}: {
  role: AppRole;
  showExpertise?: boolean;
}) {
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ["profile", role],
    queryFn: () => profileApi.getProfile(role),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your personal information and security settings." />

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !profile ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 w-full lg:col-span-1" />
          <Skeleton className="h-64 w-full lg:col-span-2" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="h-fit lg:col-span-1">
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar className="size-20">
                <AvatarFallback className="text-lg">
                  {getInitials(profile.firstName, profile.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {profile.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileForm role={role} profile={profile} showExpertise={showExpertise} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
