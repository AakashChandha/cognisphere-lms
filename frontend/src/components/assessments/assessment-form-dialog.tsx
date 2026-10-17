"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, ListChecks, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { assessmentTypeLabel } from "@/components/assessments/assessment-badges";
import type { AssessmentSummary, AssessmentType } from "@/types/assessment";

const assessmentSchema = z.object({
  type: z.enum(["MCQ", "DOCUMENT"]),
  title: z.string().trim().min(1, "Give the assessment a title").max(160, "Keep the title under 160 characters"),
  instructions: z.string().max(4000, "Keep the instructions under 4000 characters"),
  passPercent: z
    .number({ error: "Enter a pass mark between 1 and 100" })
    .int("Use a whole number")
    .min(1, "The pass mark must be at least 1%")
    .max(100, "The pass mark cannot be above 100%"),
  /** Empty means "no limit"; the API stores null. */
  timeLimitMinutes: z
    .union([z.literal(""), z.number().int("Use a whole number of minutes").min(1, "Use at least 1 minute").max(600, "Use 600 minutes or fewer")])
    .optional(),
});

export type AssessmentFormValues = z.infer<typeof assessmentSchema>;

interface AssessmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to create, an existing assessment to edit (its type is then fixed). */
  assessment: AssessmentSummary | null;
  isSubmitting: boolean;
  onSubmit: (values: AssessmentFormValues) => void;
}

const TYPE_CHOICES: { type: AssessmentType; icon: typeof ListChecks; blurb: string }[] = [
  { type: "MCQ", icon: ListChecks, blurb: "Questions with options. Marked the moment the student submits." },
  { type: "DOCUMENT", icon: FileText, blurb: "Hand out a PDF paper; the student uploads answers for you to mark." },
];

export function AssessmentFormDialog({
  open,
  onOpenChange,
  assessment,
  isSubmitting,
  onSubmit,
}: AssessmentFormDialogProps) {
  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: { type: "MCQ", title: "", instructions: "", passPercent: 70, timeLimitMinutes: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      type: assessment?.type ?? "MCQ",
      title: assessment?.title ?? "",
      instructions: assessment?.instructions ?? "",
      passPercent: assessment?.passPercent ?? 70,
      timeLimitMinutes: assessment?.timeLimitMinutes ?? "",
    });
  }, [open, assessment, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{assessment ? "Edit assessment" : "New assessment"}</DialogTitle>
          <DialogDescription>
            {assessment
              ? "Students see these details before they start. The kind of assessment cannot be changed."
              : "Pick the kind first — it cannot be changed later."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {assessment ? null : (
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kind</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TYPE_CHOICES.map((choice) => {
                          const Icon = choice.icon;
                          const isSelected = field.value === choice.type;
                          return (
                            <button
                              key={choice.type}
                              type="button"
                              onClick={() => field.onChange(choice.type)}
                              aria-pressed={isSelected}
                              className={cn(
                                "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/60",
                              )}
                            >
                              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Icon className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                {assessmentTypeLabel(choice.type)}
                              </span>
                              <span className="text-xs text-muted-foreground">{choice.blurb}</span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Unit IG1 end-of-module test" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Tell the student what to expect, what to bring, and how they will be marked."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Shown on the assessment page before the student starts.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="passPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Pass mark <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? Number.NaN : event.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormDescription>Percent needed to pass.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeLimitMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time limit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={600}
                          placeholder="No limit"
                          value={field.value === undefined ? "" : field.value}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? "" : event.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormDescription>Minutes. Leave blank for no limit.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {assessment ? "Save changes" : "Create assessment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
