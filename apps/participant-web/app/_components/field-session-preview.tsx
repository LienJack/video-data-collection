"use client";

import { CheckCircle, CloudArrowUp, QrCode, ShieldCheck } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";
import { memo } from "react";
import styles from "@/app/home.module.css";
import { useTranslations } from "@egocapture/ui/lib/i18n";

const StatusPulse = memo(function StatusPulse() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <span className="inline-flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/64">
      <motion.span
        className="size-1.5 rounded-full bg-[var(--home-accent)]"
        animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      {t("participantUi.previewReady")}
    </span>
  );
});

const ScanLine = memo(function ScanLine() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className={styles.scanLine}
      animate={reduceMotion ? { opacity: 0.22 } : { opacity: [0, 0.4, 0], y: [0, 235, 235] }}
      transition={{ duration: 4.8, repeat: Infinity, times: [0, 0.72, 1], ease: "easeInOut", repeatDelay: 1.4 }}
      aria-hidden="true"
    />
  );
});

export const FieldSessionPreview = memo(function FieldSessionPreview() {
  const t = useTranslations();
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={styles.previewShell}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      aria-label={t("participantUi.previewAria")}
    >
      <div className="flex items-center justify-between border-b border-white/9 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/60">{t("participantUi.previewDemo")}</p>
          <p className="mt-1 text-sm font-medium text-white/88">{t("participantUi.previewActivity")}</p>
        </div>
        <StatusPulse />
      </div>

      <div className={styles.viewfinder}>
        <div className={styles.fieldScene} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
        <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />
        <ScanLine />

        <div className={styles.markerPanel}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--home-ink)] shadow-[0_10px_30px_rgb(0_0_0_/_18%)]">
            <QrCode size={22} weight="regular" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/45">{t("participantUi.previewMarker")}</p>
            <p className="mt-1 text-sm font-medium text-white">{t("participantUi.previewMarkerReady")}</p>
            <p className="mt-1 text-[0.66rem] text-white/48">{t("participantUi.previewNoIdentity")}</p>
          </div>
          <CheckCircle className="ml-auto size-5 shrink-0 text-[var(--home-accent)]" weight="regular" aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/9 border-t border-white/9">
        <PreviewFact icon={ShieldCheck} label={t("participantUi.previewTaskVersion")} value={t("participantUi.previewFrozen")} />
        <PreviewFact icon={QrCode} label={t("participantUi.previewSessionMarker")} value={t("participantUi.previewGenerated")} />
        <PreviewFact icon={CloudArrowUp} label={t("participantUi.previewUploadStatus")} value={t("participantUi.previewAwaitRecording")} />
      </div>
    </motion.section>
  );
});

function PreviewFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="px-3 py-4 sm:px-5">
      <Icon className="size-4 text-white/48" weight="regular" aria-hidden="true" />
      <p className="mt-4 text-[0.58rem] uppercase tracking-[0.12em] text-white/58">{label}</p>
      <p className="mt-1 text-xs font-medium text-white/78">{value}</p>
    </div>
  );
}
