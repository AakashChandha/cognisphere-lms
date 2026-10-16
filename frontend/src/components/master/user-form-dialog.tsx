"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordField } from "@/components/master/password-field";
import { AppRole } from "@/types/auth";
import type { ManagedUser } from "@/types/people";

const ROLE_OPTIONS: { value: AppRole; label: string; hint: string }[] = [
  { value: AppRole.STUDENT, label: "Student", hint: "Takes courses" },
  { value: AppRole.TUTOR, label: "Tutor", hint: "Creates and teaches courses" },
  { value: AppRole.MASTER, label: "Administrator", hint: "Manages everyone and everything" },
];

function buildSchema(isCreate: boolean) {
  return z.object({
    email: isCreate
      ? z.string().trim().min(1, "Email is required").email("Enter a valid email address")
      : z.string().email().optional().or(z.literal("")),
    password: isCreate
      ? z.string().min(8, "Use at least 8 characters")
      : z.string().optional().or(z.literal("")),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
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
        roles: user?.roles ?? [AppRole.STUDENT],
      });
    }
  }, [open, user, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add a person" : `Edit ${user.firstName} ${user.lastName}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "They sign in with this email and the temporary password, then choose their own password."
              : "Change their name or what they can do."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      First name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input autoFocus autoComplete="off" {...field} />
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
                    <FormLabel>
                      Last name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
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
                      <FormLabel>
                        Email <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="name@company.com" autoComplete="off" {...field} />
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
                      <FormLabel>
                        Temporary password <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <PasswordField value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                      </FormControl>
                      <FormDescription>Share it with them privately. They will be asked to change it at first sign-in.</FormDescription>
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
                  <FormLabel>What can they do?</FormLabel>
                  <div className="grid gap-2">
                    {ROLE_OPTIONS.map((option) => {
                      const checked = field.value.includes(option.value);
                      const id = `role-${option.value}`;
                      return (
                        <label
                          key={option.value}
                          htmlFor={id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/60 has-data-checked:border-primary has-data-checked:bg-primary/5"
                        >
                          <Checkbox
                            id={id}
                            className="mt-0.5"
                            aria-label={option.label}
                            checked={checked}
                            onCheckedChange={(value) => {
                              if (value) {
                                field.onChange([...field.value, option.value]);
                              } else {
                                field.onChange(field.value.filter((r) => r !== option.value));
                              }
                            }}
                          />
                          <span>
                            <span className="block font-medium text-foreground">{option.label}</span>
                            <span className="block text-xs text-muted-foreground">{option.hint}</span>
                          </span>
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
                {isCreate ? "Create account" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
