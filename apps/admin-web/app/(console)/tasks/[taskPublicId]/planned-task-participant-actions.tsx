"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Prohibit, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function PlannedTaskParticipantActions({
  taskPublicId,
  participantPublicId,
  participantAlias,
}: {
  taskPublicId: string;
  participantPublicId: string;
  participantAlias: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setError("");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/admin/tasks/${taskPublicId}/participants/${participantPublicId}`,
      { method: "DELETE" },
    );
    const payload = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message || "无法从发布名单移除，请重试。");
      setBusy(false);
      return;
    }
    close();
    router.refresh();
    setBusy(false);
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-[var(--destructive)] hover:bg-red-50 hover:text-[var(--destructive)]"
        onClick={open}
        aria-label={`移除 ${participantAlias}`}
      >
        <Prohibit className="size-4" />移除
      </Button>
      <dialog
        ref={dialogRef}
        onCancel={(event) => { event.preventDefault(); close(); }}
        className="apple-dialog w-[min(32rem,calc(100%-1.5rem))] p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]"
      >
        <div className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="page-kicker">{participantPublicId}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">从发布名单移除</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="关闭移除参与者窗口"><X className="size-5" /></Button>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="font-semibold">{participantAlias}</p>
          <Alert><AlertDescription>该任务尚未发布，因此还没有生成 Assignment、Session 或上传记录。移除后，也可以再次添加或换成其他参与者。</AlertDescription></Alert>
          {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
        <div className="apple-dialog-footer flex justify-end gap-2 px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={close}>取消</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "正在移除…" : "确认移除"}</Button>
        </div>
      </dialog>
    </>
  );
}
