export default function AdminLoading() {
  return (
    <main className="app-page" aria-busy="true" aria-label="正在加载管理页面">
      <div className="skeleton h-3 w-36" />
      <div className="skeleton mt-4 h-14 w-72 max-w-full" />
      <div className="mt-10 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="surface-solid p-7"><div className="skeleton h-64" /></div>
        <div className="surface p-7"><div className="skeleton h-64" /></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>
    </main>
  );
}
