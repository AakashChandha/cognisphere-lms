"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/shared/markdown-content";
import type { Lesson } from "@/types/lesson";

const lessonSchema = z.object({
  title: z.string().trim().min(1, "Give the lesson a title").max(160, "Keep the title under 160 characters"),
  content: z.string(),
});

export type LessonFormValues = z.infer<typeof lessonSchema>;

interface LessonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: Lesson | null;
  isSubmitting: boolean;
  /** Show the lesson without letting it change (deactivated course seen by its tutor). */
  readOnly?: boolean;
  onSubmit: (values: LessonFormValues) => void;
}

const MARKDOWN_HINT = `## Heading
Write a paragraph of notes here.

- Bullet point
- **Bold** and *italic*
- [A link](https://example.com)`;

export function LessonFormDialog({ open, onOpenChange, lesson, isSubmitting, readOnly = false, onSubmit }: LessonFormDialogProps) {
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: { title: "", content: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ title: lesson?.title ?? "", content: lesson?.content ?? "" });
    }
  }, [open, lesson, form]);

  const content = useWatch({ control: form.control, name: "content" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Lesson" : lesson ? "Edit lesson" : "Add a lesson"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "This course is deactivated, so the lesson cannot be changed."
              : "Notes are optional. You can attach a video, slides or a PDF from the Files tab after saving."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Why manage health and safety?" autoFocus={!readOnly} disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lesson notes</FormLabel>
                    <Tabs defaultValue={readOnly ? "preview" : "write"}>
                      <TabsList>
                        <TabsTrigger value="write">Write</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                      </TabsList>
                      <TabsContent value="write" className="mt-2">
                        <FormControl>
                          <Textarea
                            rows={14}
                            placeholder={MARKDOWN_HINT}
                            className="min-h-64 font-mono text-sm"
                            disabled={readOnly}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="mt-2">
                          Use # for headings, - for bullet points and **text** for bold. Students see it formatted.
                        </FormDescription>
                      </TabsContent>
                      <TabsContent value="preview" className="mt-2">
                        <div className="min-h-64 rounded-lg border border-border p-4">
                          {content.trim() ? (
                            <MarkdownContent content={content} />
                          ) : (
                            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly ? (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {lesson ? "Save changes" : "Add lesson"}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
