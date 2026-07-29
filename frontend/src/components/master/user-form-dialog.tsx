"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AppRole } from "@/types/auth";
import type { ManagedUser } from "@/types/people";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: AppRole.MASTER, label: "Master" },
  { value: AppRole.TUTOR, label: "Tutor" },
  { value: AppRole.STUDENT, label: "Student" },
];

function buildSchema(isCreate: boolean) {
  return z.object({
    email: isCreate
      ? z.string().email("Enter a valid email address")
      : z.string().email().optional().or(z.literal("")),
    password: isCreate
      ? z.string().min(8, "Password must be at least 8 characters")
      : z.string().optional().or(z.literal("")),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    roles: z.array(z.nativeEnum(AppRole)).min(1, "Select at least one role"),
  });
}

export type UserFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: ManagedUser | null;
  isSubmitting: boolean;
  onSubmit: (values: UserFormValues) => void;
}

export function UserFormDialog({ open, onOpenChange, user, isSubmitting, onSubmit }: UserFormDialogProps) {
  const isCreate = !user;
  const schema = React.useMemo(() => buildSchema(isCreate), [isCreate]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "", roles: [] },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email ?? "",
        password: "",
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        roles: user?.roles ?? [],
      });
    }
  }, [open, user, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create new user" : "Edit user"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            {isCreate ? (
              <>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temporary password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="At least 8 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}

            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <div className="flex flex-wrap gap-4">
                    {ROLE_OPTIONS.map((option) => {
                      const checked = field.value.includes(option.value);
                      return (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              if (value) {
                                field.onChange([...field.value, option.value]);
                              } else {
                                field.onChange(field.value.filter((r) => r !== option.value));
                              }
                            }}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isCreate ? "Create user" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
