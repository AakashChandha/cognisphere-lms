"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { profileApi } from "@/lib/api/profile.api";
import { useAuth } from "@/lib/auth/auth-context";
import type { AppRole } from "@/types/auth";
import type { Profile } from "@/types/people";
import { ApiError } from "@/types/api";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  bio: z.string().optional(),
  expertise: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  role: AppRole;
  profile: Profile;
  showExpertise?: boolean;
  showBio?: boolean;
}

export function ProfileForm({ role, profile, showExpertise = false, showBio = true }: ProfileFormProps) {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
      expertise: profile.expertise ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => profileApi.updateProfile(role, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", role], updated);
      void refreshUser();
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update profile");
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormItem>
          <FormLabel>Email</FormLabel>
          <Input value={profile.email} disabled />
          <p className="text-xs text-muted-foreground">Ask an administrator if your email needs to change.</p>
        </FormItem>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Include your country code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showExpertise ? (
          <FormField
            control={form.control}
            name="expertise"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Areas of expertise</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. NEBOSH IGC, fire safety, risk assessment" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {showBio ? (
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Tell us a little about yourself" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save changes
        </Button>
      </form>
    </Form>
  );
}
