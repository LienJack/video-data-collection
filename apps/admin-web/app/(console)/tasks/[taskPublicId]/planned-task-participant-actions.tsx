"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Button } from "@egocapture/ui/components/button";
import { Prohibit, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@egocapture/ui/lib/i18n";

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
  const i18n = useI18n();
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
    const payload = await response.json() as { error?: { code?: string } };
    if (!response.ok) {
      setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.rosterRemoveFailed"));
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
        aria-label={`${i18n.t("adminUi.remove")} ${participantAlias}`}
      >
        <Prohibit className="size-4" />{i18n.t("adminUi.remove")}
      </Button>
      <dialog
        ref={dialogRef}
        onCancel={(event) => { event.preventDefault(); close(); }}
        className="apple-dialog w-[min(32rem,calc(100%-1.5rem))] p-0 text-[var(--ink)] backdrop:bg-[rgb(15_23_42_/_28%)]"
      >
        <div className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="page-kicker">{participantPublicId}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{i18n.t("adminUi.removeFromRoster")}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={close} aria-label={i18n.t("adminUi.closeRemoveParticipant")}><X className="size-5" /></Button>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="font-semibold">{participantAlias}</p>
          <Alert><AlertDescription>{i18n.t("adminUi.removeRosterHelp")}</AlertDescription></Alert>
          {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
        <div className="apple-dialog-footer flex justify-end gap-2 px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={close}>{i18n.t("common.cancel")}</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? i18n.t("adminUi.removing") : i18n.t("adminUi.confirmRemove")}</Button>
        </div>
      </dialog>
    </>
  );
}
