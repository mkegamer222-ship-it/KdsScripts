export default function Loading() {
  return (
    <div className="space-y-6 pt-4">
      <div className="skeleton h-10 w-2/3 max-w-md" />
      <div className="skeleton h-4 w-1/3 max-w-xs" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card space-y-3 p-3">
            <div className="skeleton aspect-video w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
