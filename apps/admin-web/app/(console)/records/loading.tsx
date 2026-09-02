import { Skeleton } from "@egocapture/ui/components/skeleton";

export default function RecordsLoading() {
  return (
    <main className="app-page" aria-busy="true" aria-label="正在加载采集记录">
      <header className="border-b border-[var(--line)] pb-7"><Skeleton className="h-3 w-28" /><Skeleton className="mt-4 h-14 w-56 max-w-full" /><Skeleton className="mt-4 h-5 w-full max-w-2xl" /></header>
      <section className="mt-7 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</section>
      <Skeleton className="mt-4 h-48 rounded-[1.35rem]" />
      <Skeleton className="mt-6 h-14 rounded-2xl" />
      <section className="mt-6 grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-72 rounded-[1.35rem]" />)}</section>
    </main>
  );
}
