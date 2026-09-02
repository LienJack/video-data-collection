import { buttonVariants } from "@egocapture/ui/components/button";
import Link from "next/link";
import { TaskEditor } from "@/app/(console)/tasks/task-editor";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { requireAdmin } from "@/lib/auth";

export default async function NewTaskPage() {
  await requireAdmin();
  return <main className="content-page"><Link href="/tasks" className={buttonVariants({ variant: "outline", className: "" })}>← Tasks</Link><p className="page-kicker mt-10">Mutable workspace</p><h1 className="page-title">创建 Task Draft</h1><TaskEditor mode="create" initialInstructions={JSON.stringify(defaultTaskInstructions, null, 2)} /></main>;
}
