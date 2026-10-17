"use client";

import { useParams } from "next/navigation";
import { QueryThreadView } from "@/components/queries/query-thread-view";

export default function TutorQueryThreadPage() {
  const params = useParams<{ id: string }>();
  return <QueryThreadView role="tutor" queryId={params.id} />;
}
