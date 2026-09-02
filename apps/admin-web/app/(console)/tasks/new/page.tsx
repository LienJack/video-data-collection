import { buttonVariants } from "@egocapture/ui/components/button";
import Link from "next/link";
import { TaskEditor } from "@/app/(console)/tasks/task-editor";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { requireAdmin } from "@/lib/auth";

export default async function NewTaskPage() {
  await requireAdmin();
  const initialInstructions = structuredClone(defaultTaskInstructions);
  initialInstructions.title = "";
  initialInstructions.description = "";

  return (
    <main className="content-page">
      <Link href="/tasks" className={buttonVariants({ variant: "outline", className: "" })}>← 任务列表</Link>
      <p className="page-kicker mt-10">任务模板</p>
      <h1 className="page-title">创建录制任务</h1>
      <TaskEditor mode="create" initialInstructions={initialInstructions} />
    </main>
  );
}
