import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import {
  ArrowRight,
  CheckCircle,
  FileVideo,
  Scan,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { getTaskOperations } from "@egocapture/core/server/services/tasks";

type TaskOperations = Awaited<ReturnType<typeof getTaskOperations>>;

type Upload = Omit<TaskOperations["uploads"][number], "createdAt"> & { createdAt: string | Date };

type TaskUploadsPanelProps = { uploads: Upload[] };

const transferLabels: Record<string, string> = {
  created: "等待上传",
  uploading: "上传中",
  reconciling: "正在核对",
  verified: "上传已验证",
  failed: "上传失败",
  aborted: "上传已中止",
  expired: "上传已过期",
};

const metadataLabels: Record<string, string> = {
  pending: "等待解析",
  processing: "解析中",
  extracted: "解析完成",
  partial: "部分解析",
  unsupported: "格式不支持",
  failed: "解析失败",
};

const matchLabels: Record<string, string> = {
  participant_claim: "参与者声明",
  admin_confirmed: "管理员已确认",
  admin_corrected: "管理员已纠正",
  rejected: "匹配已拒绝",
};

const healthyTransfers = new Set(["verified"]);
const unhealthyTransfers = new Set(["failed", "aborted", "expired"]);
const unhealthyMetadata = new Set(["partial", "unsupported", "failed"]);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return "时长待解析";
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function uploadHealth(upload: Upload) {
  if (unhealthyTransfers.has(upload.transferStatus) || unhealthyMetadata.has(upload.metadataStatus) || upload.reviewCount > 0) {
    return { label: "需要处理", variant: "destructive" as const, icon: WarningCircle };
  }
  if (healthyTransfers.has(upload.transferStatus) && upload.decisionType) {
    return { label: "已就绪", variant: "secondary" as const, icon: CheckCircle };
  }
  return { label: "处理中", variant: "outline" as const, icon: UploadSimple };
}

export function TaskUploadsPanel({ uploads }: TaskUploadsPanelProps) {
  const attentionCount = uploads.filter((upload) => uploadHealth(upload).label === "需要处理").length;

  return (
    <section aria-labelledby="task-uploads-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="task-uploads-heading" className="display text-2xl font-semibold">上传视频</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">共 {uploads.length} 个上传{attentionCount > 0 ? `，其中 ${attentionCount} 个需要处理` : "，当前没有待处理异常"}。</p>
        </div>
        {attentionCount > 0 ? (
          <Link href="/review" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white shadow-sm outline-none transition-[transform,opacity] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 active:scale-[0.98]">
            <Scan className="size-4" weight="bold" />打开待处理<ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {uploads.map((upload) => {
          const health = uploadHealth(upload);
          const HealthIcon = health.icon;
          return (
            <Card key={upload.publicId} as="article" className="gap-5 rounded-[1.35rem] border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><FileVideo className="size-5" weight="duotone" /></span>
                  <div className="min-w-0">
                    <h3 className="break-all text-sm font-semibold leading-5">{upload.originalFilename}</h3>
                    <p className="mt-1 break-all text-xs text-[var(--muted)]">{upload.publicId}</p>
                  </div>
                </div>
                <Badge variant={health.variant}><HealthIcon weight="fill" />{health.label}</Badge>
              </div>

              <dl className="grid grid-cols-1 gap-2.5 min-[28rem]:grid-cols-2">
                <StatusItem label="上传" value={transferLabels[upload.transferStatus] ?? upload.transferStatus} warning={unhealthyTransfers.has(upload.transferStatus)} />
                <StatusItem label="元数据" value={metadataLabels[upload.metadataStatus] ?? upload.metadataStatus} warning={unhealthyMetadata.has(upload.metadataStatus)} />
                <StatusItem label="匹配" value={upload.decisionType ? matchLabels[upload.decisionType] ?? upload.decisionType : "等待匹配"} warning={!upload.decisionType} />
                <StatusItem label="人工复核" value={upload.reviewCount > 0 ? `${upload.reviewCount} 项待处理` : "无需处理"} warning={upload.reviewCount > 0} />
              </dl>

              <div className="rounded-2xl bg-[var(--paper)] p-4 text-xs leading-5 text-[var(--muted)]">
                <p className="break-words font-semibold text-[var(--ink)]">{upload.participantAlias} · <span className="break-all">{upload.participantPublicId}</span></p>
                <p className="mt-1 break-all">Session：{upload.sessionPublicId ?? "尚未确定"}</p>
                <p className="mt-1 break-words">
                  {formatBytes(upload.sizeBytes)} · {formatDuration(upload.durationMs)}
                  {upload.width && upload.height ? ` · ${upload.width}×${upload.height}` : " · 分辨率待解析"}
                  {upload.frameRate ? ` · ${upload.frameRate.toFixed(2)} fps` : ""}
                </p>
                <p className="mt-1">设备一致性：{upload.deviceConsistency ?? "等待核对"}</p>
              </div>

              <div className="flex flex-col gap-2 min-[28rem]:flex-row">
                <Link href={`/uploads/${upload.publicId}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white outline-none transition-[transform,opacity] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 active:scale-[0.98]">
                  查看上传详情<ArrowRight className="size-4" />
                </Link>
                {upload.reviewCount > 0 ? (
                  <Link href="/review" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--teal-soft)] px-4 text-sm font-semibold text-[var(--signal-dark)] outline-none transition-[transform,background-color] hover:bg-[var(--paper-deep)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]">
                    <Scan className="size-4" />处理异常
                  </Link>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {uploads.length === 0 ? (
        <div className="rounded-[1.35rem] border border-dashed border-[var(--line)] bg-white/60 px-5 py-12 text-center shadow-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--signal-dark)]" aria-hidden="true"><FileVideo className="size-6" /></span>
          <h3 className="mt-4 font-semibold">还没有上传视频</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">参与者创建录制并上传后，传输、元数据、匹配和复核状态会集中显示在这里。</p>
        </div>
      ) : null}
    </section>
  );
}

function StatusItem({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/55 p-3">
      <dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-[var(--muted)]">{label}</dt>
      <dd className={`mt-1 flex items-start gap-1.5 break-words text-sm font-semibold ${warning ? "text-[var(--destructive)]" : "text-[var(--ink)]"}`}>
        {warning ? <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden="true" /> : <CheckCircle className="mt-0.5 size-4 shrink-0 text-[var(--signal-dark)]" weight="fill" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}
