import { Badge } from "@egocapture/ui/components/badge";
import { Card } from "@egocapture/ui/components/card";
import { ArrowSquareOut, CheckCircle, Compass, Flask, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

type GuideStatus = "current" | "future" | "boundary";

const statusConfig: Record<GuideStatus, { label: string; icon: ReactNode; className: string }> = {
  current: {
    label: "当前已实现",
    icon: <CheckCircle weight="fill" aria-hidden="true" />,
    className: "border-transparent bg-[var(--teal-soft)] text-[var(--signal-dark)]",
  },
  future: {
    label: "未来方案",
    icon: <Flask weight="duotone" aria-hidden="true" />,
    className: "border-transparent bg-violet-50 text-violet-700",
  },
  boundary: {
    label: "能力边界",
    icon: <WarningCircle weight="duotone" aria-hidden="true" />,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

export function StatusPill({ status }: { status: GuideStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function GuideArticle({
  id,
  number,
  eyebrow,
  title,
  summary,
  statuses,
  icon,
  children,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  statuses: GuideStatus[];
  icon: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;

  return (
    <Card
      as="article"
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-28 gap-0 overflow-hidden rounded-[1.6rem] border-white/80 bg-white/82 py-0 shadow-[var(--shadow-soft)] target:ring-2 target:ring-[var(--ring)] target:ring-offset-4 target:ring-offset-[var(--paper)]"
    >
      <header className="border-b border-[var(--line)] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--teal-soft)] text-[var(--signal-dark)] sm:size-12" aria-hidden="true">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="page-kicker">{number} · {eyebrow}</p>
              <h2 id={headingId} className="display mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                {title}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">{statuses.map((status) => <StatusPill key={status} status={status} />)}</div>
        </div>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--muted)] sm:ms-16 sm:mt-6 sm:text-lg sm:leading-8">{summary}</p>
      </header>
      <div className="space-y-9 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">{children}</div>
    </Card>
  );
}

export function GuideSection({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">{eyebrow}</p> : null}
      <h3 className="display mt-1 text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-[1.7rem]">{title}</h3>
      <div className="mt-4 space-y-4 text-[0.94rem] leading-7 text-[var(--muted)] sm:text-base sm:leading-8">{children}</div>
    </section>
  );
}

export function Conclusion({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "amber" | "violet" }) {
  const color = tone === "amber"
    ? "border-amber-200 bg-amber-50/80"
    : tone === "violet"
      ? "border-violet-200 bg-violet-50/75"
      : "border-blue-200 bg-[var(--teal-soft)]/75";

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${color}`}>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
        <Compass className="size-4 text-[var(--signal)]" weight="duotone" aria-hidden="true" />
        结论先行
      </p>
      <div className="mt-3 text-sm leading-7 text-[var(--ink)] sm:text-base sm:leading-8">{children}</div>
    </div>
  );
}

export function GuideDiagram({ title, description, src }: { title: string; description: string; src: string }) {
  const diagramSlug = src.split("/").at(-1)?.replace(/\.html$/, "") ?? "unknown";

  return (
    <figure className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
      <figcaption className="flex flex-col gap-4 border-b border-[var(--line)] bg-white/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--ink)]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--signal-dark)] shadow-sm outline-none transition hover:border-[var(--signal)] hover:bg-[var(--teal-soft)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          打开交互图
          <ArrowSquareOut className="size-4" aria-hidden="true" />
        </a>
      </figcaption>
      <iframe
        src={src}
        title={title}
        data-testid={`guide-diagram-${diagramSlug}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="block h-[34rem] w-full border-0 bg-white sm:h-[42rem] lg:h-[46rem]"
      />
    </figure>
  );
}

export function StepList({ items }: { items: Array<{ title: string; description: ReactNode }> }) {
  return (
    <ol className="grid gap-3">
      {items.map((item, index) => (
        <li key={item.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:p-5">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white sm:size-9" aria-hidden="true">{index + 1}</span>
          <div>
            <p className="font-semibold leading-6 text-[var(--ink)]">{item.title}</p>
            <div className="mt-1 text-sm leading-6 text-[var(--muted)] sm:leading-7">{item.description}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FactGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/70 p-4 sm:p-5">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--signal)]">{item.label}</dt>
          <dd className="mt-2 text-sm leading-6 text-[var(--ink)] sm:leading-7">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Reference = { label: string; href?: string; note?: string };

export function ReferenceList({ items }: { items: Reference[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/65 p-5 sm:p-6" aria-label="依据与延伸阅读">
      <h3 className="text-sm font-semibold text-[var(--ink)]">依据与延伸阅读</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--signal)]" aria-hidden="true" />
            <span>
              {item.href ? (
                <a className="font-semibold text-[var(--signal-dark)] underline decoration-[var(--signal)]/30 underline-offset-4 hover:decoration-[var(--signal)]" href={item.href} target="_blank" rel="noreferrer">
                  {item.label}<span className="sr-only">（在新标签页打开）</span>
                </a>
              ) : <code className="break-all rounded bg-white px-1.5 py-0.5 text-[0.8rem] text-[var(--ink)]">{item.label}</code>}
              {item.note ? <span> — {item.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="break-words rounded-md bg-[var(--paper-deep)] px-1.5 py-0.5 font-mono text-[0.82em] text-[var(--ink)]">{children}</code>;
}
