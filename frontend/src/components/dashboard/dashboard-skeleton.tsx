import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[--surface] border border-[--border] rounded-lg p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16 mt-2" />
            <Skeleton className="h-3 w-32 mt-2" />
          </div>
        ))}
      </div>
      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[--surface] border border-[--border] rounded-lg p-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-28 mt-3" />
            <Skeleton className="h-3 w-40 mt-2" />
          </div>
        ))}
      </div>
      {/* Activity feed */}
      <div className="bg-[--surface] border border-[--border] rounded-lg p-4">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
