"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { tutorCoursesApi } from "@/lib/api/courses.api";
import { tutorsApi } from "@/lib/api/tutors.api";
import { ApiError } from "@/types/api";

const UNASSIGNED = "none";

const createCourseSchema = z.object({
  title: z.string().trim().min(1, "Course title is required").max(160, "Keep the title under 160 characters"),
  description: z.string().trim().min(10, "Write at least a sentence so students know what the course covers"),
  thumbnailUrl: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
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

  const form = useForm<CreateCourseValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { title: "", description: "", thumbnailUrl: "", tutorId: UNASSIGNED },
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
    mutationFn: (values: CreateCourseValues) =>
      tutorCoursesApi.create({
        title: values.title,
        description: values.description,
        thumbnailUrl: values.thumbnailUrl || undefined,
        tutorId: isMaster && values.tutorId !== UNASSIGNED ? values.tutorId : undefined,
      }),
    onSuccess: (course) => {
      toast.success(isMaster ? "Draft created. Add lessons or assign a tutor to do it." : "Draft created. Now add your first lesson.");
      router.push(`${basePath}/${course.id}?tab=lessons`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create course");
    },
  });

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
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
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
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover image URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
