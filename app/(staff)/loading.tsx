export default function StaffLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-56 animate-pulse rounded bg-white/10" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="h-20 animate-pulse rounded border border-white/10 bg-white/5" />
        <div className="h-20 animate-pulse rounded border border-white/10 bg-white/5" />
        <div className="h-20 animate-pulse rounded border border-white/10 bg-white/5" />
        <div className="h-20 animate-pulse rounded border border-white/10 bg-white/5" />
      </div>
      <div className="h-56 animate-pulse rounded border border-white/10 bg-white/5" />
    </div>
  );
}
