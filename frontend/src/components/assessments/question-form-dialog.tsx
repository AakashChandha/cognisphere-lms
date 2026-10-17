"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { AssessmentQuestionDto } from "@/types/assessment";

const MAX_OPTIONS = 8;

const questionSchema = z.object({
  prompt: z.string().trim().min(1, "Write the question").max(2000, "Keep the question under 2000 characters"),
  points: z
    .number({ error: "Enter how many points this question is worth" })
    .int("Use a whole number")
    .min(1, "A question is worth at least 1 point")
    .max(100, "Use 100 points or fewer"),
  options: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Fill in or remove this option").max(500, "Keep options under 500 characters"),
        isCorrect: z.boolean(),
      }),
    )
    .min(2, "A question needs at least two options")
    .max(MAX_OPTIONS, `Use ${MAX_OPTIONS} options or fewer`)
    .refine((options) => options.filter((option) => option.isCorrect).length === 1, {
      message: "Mark exactly one option as the correct answer",
    }),
});

export type QuestionFormValues = z.infer<typeof questionSchema>;

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to add, an existing question to edit. Editing replaces the whole option set. */
  question: AssessmentQuestionDto | null;
  isSubmitting: boolean;
  onSubmit: (values: QuestionFormValues) => void;
}

function emptyOptions() {
  return [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ];
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  isSubmitting,
  onSubmit,
}: QuestionFormDialogProps) {
  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { prompt: "", points: 1, options: emptyOptions() },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      prompt: question?.prompt ?? "",
      points: question?.points ?? 1,
      options:
        question && question.options.length > 0
          ? question.options.map((option) => ({ text: option.text, isCorrect: !!option.isCorrect }))
          : emptyOptions(),
    });
  }, [open, question, form]);

  const options = useWatch({ control: form.control, name: "options" });
  const correctIndex = (options ?? []).findIndex((option) => option?.isCorrect);
  const optionsError =
    form.formState.errors.options?.root?.message ?? form.formState.errors.options?.message;

  function setCorrect(index: number) {
    const current = form.getValues("options");
    form.setValue(
      "options",
      current.map((option, i) => ({ ...option, isCorrect: i === index })),
      { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
    );
  }

  function removeOption(index: number) {
    const wasCorrect = form.getValues(`options.${index}.isCorrect`);
    remove(index);
    if (wasCorrect) {
      // Never leave the question without an answer key.
      const remaining = form.getValues("options");
      if (remaining.length > 0) setCorrect(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "Add a question"}</DialogTitle>
          <DialogDescription>
            Give at least two options and mark exactly one of them correct.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Question <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="e.g. Which document records a workplace risk assessment?" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem className="max-w-40">
                    <FormLabel>Points</FormLabel>
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
                    <FormDescription>Weight in the final score.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>
                  Options <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={correctIndex >= 0 ? String(correctIndex) : null}
                  onValueChange={(value) => {
                    if (value !== null) setCorrect(Number(value));
                  }}
                  aria-label="Correct answer"
                  className="gap-2"
                >
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex items-start gap-2">
                      <div className="flex h-8 shrink-0 items-center">
                        <RadioGroupItem
                          value={String(index)}
                          aria-label={`Mark option ${index + 1} as correct`}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <FormField
                          control={form.control}
                          name={`options.${index}.text`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder={`Option ${index + 1}`} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="mt-0.5 shrink-0"
                        disabled={fields.length <= 2}
                        onClick={() => removeOption(index)}
                        aria-label={`Remove option ${index + 1}`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Select the radio button beside the correct answer.
                </p>
                {optionsError ? <p className="text-sm text-destructive">{optionsError}</p> : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fields.length >= MAX_OPTIONS}
                  onClick={() => append({ text: "", isCorrect: false })}
                >
                  <Plus className="size-3.5" />
                  Add option
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {question ? "Save question" : "Add question"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
