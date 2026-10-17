"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileIcon, Loader2, UploadCloud, X } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { StudyMaterial } from "@/types/study-material";

/** Mirrors the course-file pipeline: only types a student can view in-browser. */
export const MATERIAL_ACCEPTED_TYPES =
  ".pdf,.pptx,.mp4,.m4v,.webm,application/pdf,video/mp4,video/webm";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

const materialSchema = z.object({
  title: z.string().trim().min(1, "Give the material a title").max(200, "Keep the title under 200 characters"),
  description: z.string().trim().max(1000, "Keep the description under 1000 characters"),
  courseId: z.string().min(1, "Choose the course this belongs to"),
});

export type StudyMaterialFormValues = z.infer<typeof materialSchema>;

export interface CourseOption {
  id: string;
  title: string;
}

interface StudyMaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing material; omit to upload a new one. */
  material?: StudyMaterial | null;
  courses: CourseOption[];
  coursesLoading?: boolean;
  isSubmitting: boolean;
  uploadProgress?: number;
  onSubmit: (values: StudyMaterialFormValues, file: File | null) => void;
}

export function StudyMaterialFormDialog({
  open,
  onOpenChange,
  material,
  courses,
  coursesLoading = false,
  isSubmitting,
  uploadProgress,
  onSubmit,
}: StudyMaterialFormDialogProps) {
  const isEdit = !!material;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const form = useForm<StudyMaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: { title: "", description: "", courseId: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    // Opening the dialog resets it to the material being edited (or to empty).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFile(null);
    setFileError(null);
    form.reset({
      title: material?.title ?? "",
      description: material?.description ?? "",
      courseId: material?.courseId ?? "",
    });
  }, [open, material, form]);

  const courseItems = React.useMemo(() => {
    const items: Record<string, string> = {};
    for (const course of courses) items[course.id] = course.title;
    return items;
  }, [courses]);

  function stage(candidate: File) {
    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`That file is larger than ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
      return;
    }
    setFileError(null);
    setFile(candidate);
  }

  function handleSubmit(values: StudyMaterialFormValues) {
    if (!isEdit && !file) {
      setFileError("Choose the file to upload.");
      return;
    }
    onSubmit(values, file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit study material" : "Add study material"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change how this material is described, or move it to another course."
              : "Reference material — a book, a standard, a handout — for the students of one course. They can read it in the browser but never download it."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {isEdit ? null : (
                <div className="space-y-2">
                  <FormLabel>
                    File <span className="text-destructive">*</span>
                  </FormLabel>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted/50",
                      isSubmitting && "pointer-events-none opacity-50",
                    )}
                  >
                    <UploadCloud className="size-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Choose a file</p>
                    <p className="text-xs text-muted-foreground">PDF, PowerPoint (.pptx) or MP4 video</p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept={MATERIAL_ACCEPTED_TYPES}
                      className="hidden"
                      disabled={isSubmitting}
                      onChange={(event) => {
                        const chosen = event.target.files?.[0];
                        if (chosen) stage(chosen);
                        event.target.value = "";
                      }}
                    />
                  </div>
                  {file ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <FileIcon className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        {isSubmitting && typeof uploadProgress === "number" ? (
                          <Progress value={uploadProgress} className="mt-2" />
                        ) : null}
                      </div>
                      {!isSubmitting ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setFile(null)}
                          aria-label="Remove the chosen file"
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
                </div>
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
                      <Input placeholder="e.g. NEBOSH IGC student handbook" {...field} />
                    </FormControl>
                    <FormDescription>This is what students see in their Materials list.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="What is this for, and which part of the course does it support?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Course <span className="text-destructive">*</span>
                    </FormLabel>
                    {/* `null` rather than "" so the placeholder shows until a course is picked. */}
                    <Select
                      items={courseItems}
                      value={field.value || null}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={coursesLoading || courses.length === 0}>
                          <SelectValue placeholder={coursesLoading ? "Loading courses..." : "Choose a course"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {courses.length === 0 && !coursesLoading
                        ? "You need a course before you can add material to it."
                        : "Only students enrolled in this course will see the material."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isEdit ? "Save changes" : "Upload material"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
