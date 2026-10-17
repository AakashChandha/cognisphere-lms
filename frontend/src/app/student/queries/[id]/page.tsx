"use client";

import { useParams } from "next/navigation";
import { QueryThreadView } from "@/components/queries/query-thread-view";

export default function StudentQueryThreadPage() {
  const params = useParams<{ id: string }>();
  return <QueryThreadView role="student" queryId={params.id} />;
}
