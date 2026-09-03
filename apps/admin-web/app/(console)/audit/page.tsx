import { redirect } from "next/navigation";
import { parseRecordsQuery, recordsHref } from "@/lib/records-query";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseRecordsQuery({ ...(await searchParams), tab: "activity" });
  redirect(recordsHref(query));
}
