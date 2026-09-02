import { buttonVariants } from "@egocapture/ui/components/button";
import Link from "next/link";
import { TaskEditor } from "@/app/(console)/tasks/task-editor";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { requireAdmin } from "@/lib/auth";
import { createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";

export default async function NewTaskPage() {
  const [, locale] = await Promise.all([requireAdmin(), requestLocale()]);
  const { t } = createTranslator(locale);
  const initialInstructions = structuredClone(defaultTaskInstructions);
  initialInstructions.title = "";
  initialInstructions.description = "";

  return (
    <main className="content-page">
      <Link href="/tasks" className={buttonVariants({ variant: "outline", className: "" })}>← {t("adminUi.taskList")}</Link>
      <p className="page-kicker mt-10">{t("adminUi.taskTemplate")}</p>
      <h1 className="page-title">{t("adminUi.createRecordingTask")}</h1>
      <TaskEditor mode="create" initialInstructions={initialInstructions} />
    </main>
  );
}
