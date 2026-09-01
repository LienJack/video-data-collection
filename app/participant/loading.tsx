export default function ParticipantLoading() {
  return (
    <main className="content-page max-w-3xl" aria-busy="true" aria-label="正在加载参与者页面">
      <div className="skeleton h-3 w-32" />
      <div className="skeleton mt-4 h-12 w-64 max-w-full" />
      <div className="skeleton mt-5 h-5 w-full" />
      <div className="surface-solid mt-10 p-6"><div className="skeleton h-52" /></div>
      <div className="surface-solid mt-4 p-6"><div className="skeleton h-36" /></div>
    </main>
  );
}
