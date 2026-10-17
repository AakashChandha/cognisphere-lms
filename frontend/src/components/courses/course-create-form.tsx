"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Lock, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { PageHeader } from "@/components/shared/page-header";
import { PageBreadcrumb } from "@/components/shared/page-breadcrumb";
import { tutorCoursesApi, uploadCourseThumbnail } from "@/lib/api/courses.api";
import { tutorsApi } from "@/lib/api/tutors.api";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { CourseProgressionMode } from "@/types/course";
import { ApiError } from "@/types/api";

const UNASSIGNED = "none";

/** Matches the API: `image/jpeg|png|webp`, at most 5 MB. */
export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const COVER_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Returns an error message, or null when the file is a usable cover image. */
export function validateCoverImage(file: File): string | null {
  if (!COVER_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size > COVER_IMAGE_MAX_BYTES) {
    return `That image is ${formatFileSize(file.size)}; the limit is ${formatFileSize(COVER_IMAGE_MAX_BYTES)}.`;
  }
  return null;
}

const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Course title is required").max(160, "Keep the title under 160 characters"),
  description: z.string().trim().min(10, "Write at least a sentence so students know what the course covers"),
  thumbnailUrl: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
  progressionMode: z.enum(["FREE", "SEQUENTIAL"]),
  tutorId: z.string(),
});

type CreateCourseValues = z.infer<typeof createCourseSchema>;

export interface CourseCreateFormProps {
  /** Where the course pages live for the current role; drives breadcrumbs and the redirect after create. */
  basePath: "/tutor/courses" | "/master/courses";
  /** Admin view: can pick which tutor the course belongs to. */
  isMaster: boolean;
}

export function CourseCreateForm({ basePath, isMaster }: CourseCreateFormProps) {
  const router = useRouter();
  const role = isMaster ? "master" : "tutor";
  // The course does not exist yet, so the chosen image is held here (with its
  // preview URL) and uploaded straight after the course is created.
  const [cover, setCover] = React.useState<{ file: File; url: string } | null>(null);
  const coverUrlRef = React.useRef<string | null>(null);

  const chooseCover = React.useCallback((file: File | null) => {
    if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    coverUrlRef.current = file ? URL.createObjectURL(file) : null;
    setCover(file && coverUrlRef.current ? { file, url: coverUrlRef.current } : null);
  }, []);

  // Release the last object URL when the form goes away.
  React.useEffect(
    () => () => {
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    },
    [],
  );

  const form = useForm<CreateCourseValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      title: "",
      description: "",
      thumbnailUrl: "",
      progressionMode: "FREE",
      tutorId: UNASSIGNED,
    },
  });

  const tutorsQuery = useQuery({
    queryKey: ["master", "tutors", "for-assign"],
    queryFn: () => tutorsApi.listForMaster({ pageSize: 100 }),
    enabled: isMaster,
  });

  const activeTutors = (tutorsQuery.data?.items ?? []).filter((tutor) => tutor.isActive);
  const tutorItems: Record<string, string> = { [UNASSIGNED]: "Leave unassigned" };
  for (const tutor of activeTutors) {
    tutorItems[tutor.id] = `${tutor.firstName} ${tutor.lastName}`;
  }

  const mutation = useMutation({
    mutationFn: async (values: CreateCourseValues) => {
      const course = await tutorCoursesApi.create({
        title: values.title,
        description: values.description,
        thumbnailUrl: values.thumbnailUrl || undefined,
        progressionMode: values.progressionMode,
        tutorId: isMaster && values.tutorId !== UNASSIGNED ? values.tutorId : undefined,
      });

      // The course is already saved at this point. A failed image upload must
      // never look like a failed creation, so it is reported separately.
      let coverFailed = false;
      if (cover) {
        try {
          await uploadCourseThumbnail(role, course.id, cover.file);
        } catch {
          coverFailed = true;
        }
      }
      return { course, coverFailed };
    },
    onSuccess: ({ course, coverFailed }) => {
      toast.success(
        isMaster ? "Draft created. Add lessons or assign a tutor to do it." : "Draft created. Now add your first lesson.",
      );
      if (coverFailed) {
        toast.warning("The course was created, but the cover image did not upload. Add it from the Details tab.");
      }
      router.push(`${basePath}/${course.id}?tab=lessons`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create course");
    },
  });

  const pastedUrl = useWatch({ control: form.control, name: "thumbnailUrl" });

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: isMaster ? "Courses" : "My courses", href: basePath }, { label: "New course" }]} />

      <PageHeader
        title="Create a new course"
        description={
          isMaster
            ? "Start with a title and description. You can add lessons yourself or hand the course to a tutor."
            : "Start with a title and description. You add lessons and material next."
        }
      />

      <Card className="max-w-2xl">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Course title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. NEBOSH IGC Unit 1 – Management of Health and Safety" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder="What will students be able to do after this course?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="progressionMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How students move through the lessons</FormLabel>
                    <ProgressionModeField
                      value={field.value}
                      onChange={field.onChange}
                      name="create-progression-mode"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Cover image (optional)</Label>
                <CoverImagePicker
                  previewUrl={cover?.url ?? (pastedUrl || null)}
                  onFileChosen={(file) => chooseCover(file)}
                  onRemove={() => {
                    chooseCover(null);
                    form.setValue("thumbnailUrl", "");
                  }}
                  disabled={mutation.isPending}
                />
                <FormField
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-normal text-muted-foreground">
                        Or paste an image URL
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." disabled={!!cover} {...field} />
                      </FormControl>
                      <FormDescription>
                        {cover
                          ? "Remove the chosen image if you would rather link to one."
                          : "An uploaded image always wins over a pasted URL."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isMaster ? (
                <FormField
                  control={form.control}
                  name="tutorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tutor (optional)</FormLabel>
                      <Select items={tutorItems} value={field.value} onValueChange={(value) => field.onChange(value ?? UNASSIGNED)}>
                        <FormControl>
                          <SelectTrigger className="w-full" disabled={tutorsQuery.isLoading}>
                            <SelectValue placeholder="Leave unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Leave unassigned</SelectItem>
                          {activeTutors.map((tutor) => (
                            <SelectItem key={tutor.id} value={tutor.id}>
                              {tutor.firstName} {tutor.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {tutorsQuery.isError
                          ? "Couldn't load the tutor list. You can assign a tutor later from the course page."
                          : "You can assign a tutor now or later from the course page."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Create draft course
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Two plain-language options rather than the enum names. Shared with the course
 * editor so create and edit read identically.
 */
export function ProgressionModeField({
  value,
  onChange,
  name,
  disabled = false,
}: {
  value: CourseProgressionMode;
  onChange: (value: CourseProgressionMode) => void;
  /** Radio group name; must be unique on the page. */
  name: string;
  disabled?: boolean;
}) {
  const options: {
    value: CourseProgressionMode;
    icon: typeof Unlock;
    title: string;
    description: string;
  }[] = [
    {
      value: "FREE",
      icon: Unlock,
      title: "Students can move freely between lessons",
      description: "Anyone enrolled can open any lesson, in any order, as often as they like.",
    },
    {
      value: "SEQUENTIAL",
      icon: Lock,
      title: "Students must finish each lesson before the next unlocks",
      description:
        "A lesson stays locked until every earlier one is finished — every file read, watched or heard to the end.",
    },
  ];

  return (
    <div className="grid gap-2">
      {options.map((option) => {
        const checked = value === option.value;
        const Icon = option.icon;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 space-y-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                {option.title}
              </span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Cover image upload with a live preview. The caller decides what "chosen"
 * means: the create form keeps the file until the course exists, while the
 * editor uploads it straight away.
 */
export function CoverImagePicker({
  previewUrl,
  onFileChosen,
  onRemove,
  disabled = false,
  isBusy = false,
}: {
  previewUrl: string | null;
  onFileChosen: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  isBusy?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  function choose(file: File) {
    const message = validateCoverImage(file);
    setError(message);
    if (!message) onFileChosen(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted sm:w-56">
          {previewUrl ? (
            // The URL can be an object URL, an uploaded file or a pasted link.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Course cover preview" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground/60" />
          )}
          {isBusy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isBusy}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              {previewUrl ? "Replace image" : "Upload image"}
            </Button>
            {previewUrl ? (
              <Button type="button" size="sm" variant="ghost" disabled={disabled || isBusy} onClick={onRemove}>
                <Trash2 className="size-3.5 text-destructive" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP, up to {formatFileSize(COVER_IMAGE_MAX_BYTES)}. A wide 16:9 image looks best.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={COVER_IMAGE_ACCEPT}
          className="hidden"
          disabled={disabled || isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) choose(file);
            event.target.value = "";
          }}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
