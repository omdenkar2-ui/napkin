import { Skeleton } from "@/components/ui/skeleton";

export function TaskSkeleton() {
  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 py-3 px-4 border-b border-[--border]">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <div className="ml-auto flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
        </div>
      </div>
      {/* Table */}
      <div className="bg-[--surface] border border-[--border] rounded-lg overflow-hidden">
        <div className="h-10 bg-[--surface-alt]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center min-h-[52px] px-4 border-b border-[--border] last:border-0 gap-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-5 w-7 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
          </div>
        ))}
      </div>
    </div>
  );
}
