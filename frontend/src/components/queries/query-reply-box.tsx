"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export const QUERY_BODY_MAX = 5000;

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending")
    .max(QUERY_BODY_MAX, `Keep it under ${QUERY_BODY_MAX} characters`),
});

type ReplyFormValues = z.infer<typeof replySchema>;

interface QueryReplyBoxProps {
  /** Resolves when the message has been accepted, so the box can clear itself. */
  onSubmit: (body: string) => Promise<void>;
  isSubmitting: boolean;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
}

export function QueryReplyBox({
  onSubmit,
  isSubmitting,
  label = "Your reply",
  placeholder = "Type your reply...",
  submitLabel = "Send reply",
}: QueryReplyBoxProps) {
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  });

  async function handleSubmit(values: ReplyFormValues) {
    await onSubmit(values.body.trim());
    form.reset({ body: "" });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder={placeholder} disabled={isSubmitting} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
