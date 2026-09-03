"use client";

import { Alert, AlertDescription } from "@egocapture/ui/components/alert";
import { Badge } from "@egocapture/ui/components/badge";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { Label } from "@egocapture/ui/components/label";
import { Textarea } from "@egocapture/ui/components/textarea";
import { CopySimple, Eye, PencilSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { RegionalPreferencesFields } from "../../_components/regional-preferences-fields";
import { useI18n } from "@egocapture/ui/lib/i18n";

type DrawerMode = "view" | "edit";
type CredentialStatus = "missing" | "pending_activation" | "pending_sync" | "ready";

type ParticipantDetail = {
  publicId: string;
  displayAlias: string;
  managementEmail: string | null;
  status: string;
  consentStatus: string;
  locale: string;
  timezone: string;
  countryRegion: string | null;
  notes: string | null;
  isFixture: boolean;
  defaultDevicePublicId: string | null;
  updatedAt: string;
  loginCredential: {
    username: string;
    password: string | null;
    loginUrl: string;
    version: number;
    status: CredentialStatus;
    canLogin: boolean;
    updatedAt: string | null;
    syncedAt: string | null;
  };
};

type ApiPayload<T> = {
  data?: T;
  error?: { code?: string; message?: string };
};

const fieldClass = "mt-2 w-full border border-[var(--line)] bg-white px-3 py-2.5";
const labelClass = "text-xs font-bold uppercase tracking-[0.12em]";

function displayValue(value: string | null, fallback: string) {
  return value || fallback;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--line)] py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-left">{children}</dd>
    </div>
  );
}

export function ParticipantRowActions({
  participantPublicId,
  fixtureProtected,
}: {
  participantPublicId: string;
  fixtureProtected: boolean;
}) {
  const router = useRouter();
  const i18n = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstEditFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const drawerSessionRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const credentialIdempotencyKeyRef = useRef<string | null>(null);
  const previousBodyOverflowRef = useRef<string | null>(null);
  const [mode, setMode] = useState<DrawerMode>("view");
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "credential" | "">("");
  const [copyStatus, setCopyStatus] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [credentialConfirmation, setCredentialConfirmation] = useState(false);

  function unlockBody() {
    if (previousBodyOverflowRef.current === null) return;
    document.body.style.overflow = previousBodyOverflowRef.current;
    previousBodyOverflowRef.current = null;
  }

  function isActiveDrawerSession(session: number) {
    return drawerSessionRef.current === session && Boolean(dialogRef.current?.open);
  }

  function clearSensitiveState() {
    drawerSessionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    mutationInFlightRef.current = false;
    setDetail(null);
    setLoading(false);
    setError("");
    setBusy("");
    setCopyStatus("");
    setCopyFailed(false);
    setCredentialConfirmation(false);
    credentialIdempotencyKeyRef.current = null;
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (dialogRef.current?.open) dialogRef.current.close();
    unlockBody();
    clearSensitiveState();
    if (restoreFocus) {
      const trigger = triggerRef.current;
      window.setTimeout(() => trigger?.focus(), 0);
    }
  }

  useEffect(() => () => {
    drawerSessionRef.current += 1;
    abortRef.current?.abort();
    mutationInFlightRef.current = false;
    unlockBody();
  }, []);

  async function loadParticipant({
    preserveError = false,
    session = drawerSessionRef.current,
  } = {}) {
    if (!isActiveDrawerSession(session)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    if (!preserveError) setError("");
    try {
      const response = await fetch(`/api/admin/participants/${participantPublicId}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json() as ApiPayload<ParticipantDetail>;
      if (
        controller.signal.aborted
        || abortRef.current !== controller
        || !isActiveDrawerSession(session)
      ) return;
      if (!response.ok || !payload.data) {
        setError(payload.error?.code ? i18n.error(payload.error.code) : i18n.t("adminUi.participantDrawer.profileLoadFailed"));
        return;
      }
      setDetail(payload.data);
    } catch (requestError) {
      if (
        !controller.signal.aborted
        && abortRef.current === controller
        && isActiveDrawerSession(session)
        && !(requestError instanceof DOMException && requestError.name === "AbortError")
      ) {
        setError(i18n.t("adminUi.participantDrawer.profileNetworkFailed"));
      }
    } finally {
      if (abortRef.current === controller && isActiveDrawerSession(session)) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  function openDrawer(nextMode: DrawerMode, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setMode(nextMode);
    clearSensitiveState();
    if (previousBodyOverflowRef.current === null) {
      previousBodyOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogRef.current?.showModal();
    titleRef.current?.focus();
    void loadParticipant({ session: drawerSessionRef.current });
  }

  useEffect(() => {
    if (!detail || mode !== "edit" || !dialogRef.current?.open) return;
    firstEditFieldRef.current?.focus();
  }, [detail, mode]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDrawer();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
    if (focusableElements.length === 0) {
      event.preventDefault();
      titleRef.current?.focus();
      return;
    }

    const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? focusableElements.at(-1) : focusableElements[0])?.focus();
    } else if (event.shiftKey && activeIndex === 0) {
      event.preventDefault();
      focusableElements.at(-1)?.focus();
    } else if (!event.shiftKey && activeIndex === focusableElements.length - 1) {
      event.preventDefault();
      focusableElements[0]?.focus();
    }
  }

  async function copyText(value: string, label: string) {
    const session = drawerSessionRef.current;
    if (!isActiveDrawerSession(session)) return;
    setCopyStatus("");
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      if (!isActiveDrawerSession(session)) return;
      setCopyStatus(i18n.t("adminUi.participantDrawer.copied", { label }));
    } catch {
      if (!isActiveDrawerSession(session)) return;
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      let copied = false;
      try {
        document.body.append(textarea);
        textarea.select();
        copied = typeof document.execCommand === "function" && document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
      if (isActiveDrawerSession(session)) {
        setCopyFailed(!copied);
        setCopyStatus(copied
          ? i18n.t("adminUi.participantDrawer.copied", { label })
          : i18n.t("adminUi.participantDrawer.copyFailed"));
      }
    }
  }

  function requestCredentialReset() {
    setError("");
    setCopyStatus("");
    setCopyFailed(false);
    setCredentialConfirmation(true);
  }

  async function resetCredential() {
    if (!detail || mutationInFlightRef.current) return;
    const session = drawerSessionRef.current;
    if (!isActiveDrawerSession(session)) return;
    const credential = detail.loginCredential;
    const isPendingSync = credential.status === "pending_sync";

    mutationInFlightRef.current = true;
    setBusy("credential");
    setError("");
    setCopyStatus("");
    setCopyFailed(false);
    const idempotencyKey = credentialIdempotencyKeyRef.current ?? crypto.randomUUID();
    credentialIdempotencyKeyRef.current = idempotencyKey;
    try {
      const response = await fetch(
        `/api/admin/participants/${participantPublicId}/credentials/reset`,
        {
          method: "POST",
          headers: { "idempotency-key": idempotencyKey },
        },
      );
      const payload = await response.json() as ApiPayload<{
        loginCredential: ParticipantDetail["loginCredential"];
        updatedAt: string;
      }>;
      if (!isActiveDrawerSession(session)) return;
      if (!response.ok || !payload.data) {
        const message = payload.error?.code
          ? i18n.error(payload.error.code)
          : i18n.t("adminUi.participantDrawer.credentialOperationFailed");
        await loadParticipant({ preserveError: true, session });
        if (!isActiveDrawerSession(session)) return;
        setError(message);
        setCredentialConfirmation(false);
        return;
      }
      setDetail((current) => current ? {
        ...current,
        updatedAt: payload.data!.updatedAt,
        loginCredential: payload.data!.loginCredential,
      } : current);
      setCopyStatus(isPendingSync
        ? i18n.t("adminUi.participantDrawer.credentialSynced")
        : i18n.t("adminUi.participantDrawer.credentialGenerated"));
      setCredentialConfirmation(false);
      credentialIdempotencyKeyRef.current = null;
      router.refresh();
    } catch {
      if (!isActiveDrawerSession(session)) return;
      await loadParticipant({ preserveError: true, session });
      if (!isActiveDrawerSession(session)) return;
      setError(i18n.t("adminUi.participantDrawer.credentialNetworkFailed"));
      setCredentialConfirmation(false);
    } finally {
      if (isActiveDrawerSession(session)) {
        mutationInFlightRef.current = false;
        setBusy("");
      }
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || fixtureProtected || mutationInFlightRef.current) return;
    const session = drawerSessionRef.current;
    if (!isActiveDrawerSession(session)) return;
    const form = new FormData(event.currentTarget);
    mutationInFlightRef.current = true;
    setBusy("save");
    setError("");
    try {
      const response = await fetch(`/api/admin/participants/${participantPublicId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayAlias: form.get("displayAlias"),
          managementEmail: form.get("managementEmail") || null,
          countryRegion: form.get("countryRegion") || null,
          locale: form.get("locale"),
          timezone: form.get("timezone"),
          notes: form.get("notes") || null,
          expectedUpdatedAt: detail.updatedAt,
        }),
      });
      const payload = await response.json() as ApiPayload<unknown>;
      if (!isActiveDrawerSession(session)) return;
      if (!response.ok) {
        if (response.status === 409 || payload.error?.code === "CONFLICT") {
          await loadParticipant({ preserveError: true, session });
          if (!isActiveDrawerSession(session)) return;
          setError(i18n.t("adminUi.participantDrawer.profileConflict"));
          return;
        }
        setError(payload.error?.code
          ? i18n.error(payload.error.code)
          : i18n.t("adminUi.participantDrawer.profileUpdateFailed"));
        return;
      }
      closeDrawer();
      router.refresh();
    } catch {
      if (isActiveDrawerSession(session)) {
        setError(i18n.t("adminUi.participantDrawer.profileUpdateNetworkFailed"));
      }
    } finally {
      if (isActiveDrawerSession(session)) {
        mutationInFlightRef.current = false;
        setBusy("");
      }
    }
  }

  const credential = detail?.loginCredential;
  const fullLoginInformation = credential?.password
    ? i18n.t("adminUi.participantDrawer.fullLoginInformation", {
        url: credential.loginUrl,
        account: credential.username,
        password: credential.password,
      })
    : "";
  const credentialLabel = credential ? {
    missing: i18n.t("adminUi.participantDrawer.credentialMissing"),
    pending_activation: i18n.t("adminUi.participantDrawer.credentialPendingActivation"),
    pending_sync: i18n.t("adminUi.participantDrawer.credentialPendingSync"),
    ready: i18n.t("adminUi.participantDrawer.credentialReady"),
  }[credential.status] : null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={i18n.t("adminUi.participantDrawer.viewAria", { id: participantPublicId })}
          onClick={(event) => openDrawer("view", event.currentTarget)}
        >
          <Eye className="size-4" />{i18n.t("common.view")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={i18n.t("adminUi.participantDrawer.editAria", { id: participantPublicId })}
          onClick={(event) => openDrawer("edit", event.currentTarget)}
        >
          <PencilSimple className="size-4" />{i18n.t("common.edit")}
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); closeDrawer(); }}
        onClick={handleBackdropClick}
        onKeyDown={handleDialogKeyDown}
        className="apple-dialog participant-drawer p-0 text-left whitespace-normal text-[var(--ink)]"
      >
        <div className="flex h-full min-h-0 flex-col bg-[var(--paper)]" onClick={(event) => event.stopPropagation()}>
          <header className="apple-dialog-header flex items-start justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="page-kicker">{participantPublicId}</p>
              <h2 ref={titleRef} id={titleId} tabIndex={-1} className="mt-1 text-2xl font-semibold tracking-[-0.035em] outline-none">
                {mode === "view"
                  ? i18n.t("adminUi.participantDrawer.viewTitle")
                  : i18n.t("adminUi.participantDrawer.editTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {mode === "view"
                  ? i18n.t("adminUi.participantDrawer.viewSubtitle")
                  : i18n.t("adminUi.participantDrawer.editSubtitle")}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => closeDrawer()} aria-label={i18n.t("adminUi.participantDrawer.closeAria")}>
              <X className="size-5" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            {loading ? <p role="status" className="py-12 text-center text-sm text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.loadingProfile")}</p> : null}

            {!loading && error && !detail ? (
              <div className="space-y-4">
                <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                <Button type="button" variant="outline" onClick={() => void loadParticipant()}>{i18n.t("adminUi.participantDrawer.reloadProfile")}</Button>
              </div>
            ) : null}

            {!loading && detail && mode === "view" ? (
              <div className="space-y-6">
                <section aria-labelledby={`${titleId}-profile`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 id={`${titleId}-profile`} className="text-lg font-semibold">{i18n.t("adminUi.participantDrawer.basicProfile")}</h3>
                    <Link href={`/participants/${participantPublicId}`} className={buttonVariants({ variant: "link", size: "sm" })}>{i18n.t("adminUi.participantDrawer.openFullDetails")}</Link>
                  </div>
                  <dl className="mt-2">
                    <DetailRow label={i18n.t("auth.participantId")}><span className="font-mono font-semibold">{detail.publicId}</span></DetailRow>
                    <DetailRow label={i18n.t("adminUi.displayAlias")}>{detail.displayAlias}</DetailRow>
                    <DetailRow label={i18n.t("common.status")}><Badge variant="outline">{i18n.state("participant.status", detail.status)}</Badge></DetailRow>
                    <DetailRow label={i18n.t("adminUi.consent")}>{i18n.state("participant.consent_status", detail.consentStatus)}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.participantDrawer.fixture")}>{detail.isFixture ? i18n.t("common.yes") : i18n.t("common.no")}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.managementEmail")}>{displayValue(detail.managementEmail, i18n.t("common.notAvailable"))}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.countryRegion")}>{detail.countryRegion ? i18n.regionName(detail.countryRegion) : i18n.t("common.notAvailable")}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.locale")}>{i18n.languageName(detail.locale)}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.timezone")}>{detail.timezone}</DetailRow>
                    <DetailRow label={i18n.t("adminUi.defaultDevice")}>{displayValue(detail.defaultDevicePublicId, i18n.t("common.notAvailable"))}</DetailRow>
                    <DetailRow label={i18n.t("common.notes")}><span className="whitespace-pre-wrap">{displayValue(detail.notes, i18n.t("common.none"))}</span></DetailRow>
                  </dl>
                </section>

                <section aria-labelledby={`${titleId}-credential`} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 id={`${titleId}-credential`} className="text-lg font-semibold">{i18n.t("adminUi.participantDrawer.loginInformation")}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.loginInformationHelp")}</p>
                    </div>
                    {credential ? <Badge variant={credential.status === "ready" ? "secondary" : "outline"}>{credentialLabel}</Badge> : null}
                  </div>

                  {credential ? (
                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.loginAddress")}</p>
                        <a href={credential.loginUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-semibold text-[var(--signal-dark)] underline underline-offset-4">{credential.loginUrl}</a>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.loginAccount")}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-[var(--paper)] px-3 py-2 text-sm">{credential.username}</code>
                          <Button type="button" size="sm" variant="outline" onClick={() => void copyText(credential.username, i18n.t("adminUi.participantDrawer.loginAccount"))}><CopySimple />{i18n.t("adminUi.participantDrawer.copyAccount")}</Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--muted)]">{i18n.t("auth.password")}</p>
                        {credential.password ? (
                          <div className="mt-1 flex items-center gap-2">
                            <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-[var(--paper)] px-3 py-2 text-sm">{credential.password}</code>
                            <Button type="button" size="sm" variant="outline" onClick={() => void copyText(credential.password!, i18n.t("auth.password"))}><CopySimple />{i18n.t("adminUi.participantDrawer.copyPassword")}</Button>
                          </div>
                        ) : <p className="mt-1 text-sm text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.passwordUnavailable")}</p>}
                      </div>

                      {credential.status === "pending_activation" ? <Alert><AlertDescription>{i18n.t("adminUi.participantDrawer.pendingActivationHelp")}</AlertDescription></Alert> : null}
                      {credential.status === "pending_sync" ? <Alert variant="destructive"><AlertDescription>{i18n.t("adminUi.participantDrawer.pendingSyncHelp")}</AlertDescription></Alert> : null}
                      {credential.status === "ready" && !credential.canLogin ? <Alert><AlertDescription>{i18n.t("adminUi.participantDrawer.readyBlockedHelp")}</AlertDescription></Alert> : null}
                      {credential.status === "ready" && credential.canLogin ? <p className="text-sm font-semibold text-[var(--signal-dark)]">{i18n.t("adminUi.participantDrawer.readyCanLogin")}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        {["ready", "pending_activation"].includes(credential.status) && credential.password ? (
                          <Button type="button" onClick={() => void copyText(fullLoginInformation, i18n.t("adminUi.participantDrawer.loginInformation"))}><CopySimple />{i18n.t("adminUi.participantDrawer.copyFullLoginInformation")}</Button>
                        ) : null}
                        {!credentialConfirmation ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy === "credential" || fixtureProtected}
                            onClick={requestCredentialReset}
                          >
                            {credential.status === "missing"
                              ? i18n.t("adminUi.participantDrawer.generatePassword")
                              : credential.status === "pending_sync"
                                ? i18n.t("adminUi.participantDrawer.continueSync")
                                : i18n.t("adminUi.participantDrawer.resetPassword")}
                          </Button>
                        ) : null}
                      </div>
                      {credentialConfirmation ? (
                        <Alert variant={credential.status === "missing" || credential.status === "pending_sync" ? "default" : "destructive"}>
                          <AlertDescription>
                            <p>
                              {credential.status === "missing"
                                ? i18n.t("adminUi.participantDrawer.confirmGeneratePassword")
                                : credential.status === "pending_sync"
                                  ? i18n.t("adminUi.participantDrawer.confirmSyncPassword")
                                  : i18n.t("adminUi.participantDrawer.confirmResetPassword")}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" size="sm" disabled={busy === "credential"} onClick={() => void resetCredential()}>{busy === "credential" ? i18n.t("adminUi.participantDrawer.processing") : i18n.t("common.confirm")}</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={busy === "credential"} onClick={() => { setCredentialConfirmation(false); credentialIdempotencyKeyRef.current = null; }}>{i18n.t("common.cancel")}</Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <p
                        aria-live="polite"
                        role={copyFailed ? "alert" : undefined}
                        className="min-h-5 text-sm font-medium text-[var(--muted)]"
                      >
                        {copyStatus}
                      </p>
                      {fixtureProtected ? <p className="text-xs text-[var(--muted)]">{i18n.t("adminUi.participantDrawer.fixtureCredentialProtected")}</p> : null}
                    </div>
                  ) : null}
                </section>

                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
              </div>
            ) : null}

            {!loading && detail && mode === "edit" ? (
              <form key={`${detail.publicId}-${detail.updatedAt}`} onSubmit={saveProfile} className="space-y-5">
                {fixtureProtected ? <Alert><AlertDescription>{i18n.t("adminUi.participantDrawer.fixtureEditProtected")}</AlertDescription></Alert> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Label className={labelClass}>{i18n.t("adminUi.displayAlias")}<Input ref={firstEditFieldRef} name="displayAlias" required maxLength={120} defaultValue={detail.displayAlias} className={fieldClass} /></Label>
                  <Label className={labelClass}>{i18n.t("adminUi.managementEmail")}<Input name="managementEmail" type="email" maxLength={254} defaultValue={detail.managementEmail ?? ""} className={fieldClass} /></Label>
                  <RegionalPreferencesFields
                    key={`${detail.publicId}:${detail.updatedAt}`}
                    defaultCountry={detail.countryRegion}
                    defaultLocale={detail.locale}
                    defaultTimezone={detail.timezone}
                    fieldClassName={fieldClass}
                    labelClassName={labelClass}
                  />
                  <Label className={`${labelClass} sm:col-span-2`}>{i18n.t("common.notes")}<Textarea name="notes" maxLength={500} defaultValue={detail.notes ?? ""} className={`${fieldClass} min-h-28`} /><span className="mt-1 block font-normal normal-case tracking-normal text-[var(--muted)]">{i18n.t("adminUi.sensitiveNotesHelp")}</span></Label>
                </div>
                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
                <div className="apple-dialog-footer sticky -right-5 -bottom-5 -left-5 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-[var(--line)] px-5 py-4 sm:-right-7 sm:-left-7 sm:-mx-7 sm:px-7">
                  <Button type="button" variant="ghost" onClick={() => closeDrawer()}>{i18n.t("common.cancel")}</Button>
                  <Button type="submit" disabled={busy === "save" || fixtureProtected}>{busy === "save" ? i18n.t("common.saving") : i18n.t("adminUi.participantDrawer.saveChanges")}</Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
