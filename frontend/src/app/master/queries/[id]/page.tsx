"use client";

import { useParams } from "next/navigation";
import { QueryThreadView } from "@/components/queries/query-thread-view";

export default function MasterQueryThreadPage() {
  const params = useParams<{ id: string }>();
  return <QueryThreadView role="master" queryId={params.id} />;
}
