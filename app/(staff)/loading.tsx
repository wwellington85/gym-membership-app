export default function StaffLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-56 animate-pulse rounded bg-secondary" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="h-20 animate-pulse rounded border border-border bg-muted" />
        <div className="h-20 animate-pulse rounded border border-border bg-muted" />
        <div className="h-20 animate-pulse rounded border border-border bg-muted" />
        <div className="h-20 animate-pulse rounded border border-border bg-muted" />
      </div>
      <div className="h-56 animate-pulse rounded border border-border bg-muted" />
    </div>
  );
}
