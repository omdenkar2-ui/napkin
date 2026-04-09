import { Skeleton } from "@/components/ui/skeleton";

export function AnalysisDetailSkeleton() {
  return (
    <div className="flex flex-1 min-h-0 p-4 md:p-8 gap-6">
      {/* Left column */}
      <div className="flex-[3]">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-20 w-full rounded-lg mt-4" />
        <Skeleton className="h-5 w-32 mt-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-[--border] rounded-lg p-4 mb-3 mt-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32 mt-2" />
            <Skeleton className="h-3 w-full mt-3" />
          </div>
        ))}
      </div>
      {/* Right column */}
      <div className="flex-[2] border-l border-[--border] pl-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full mt-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-3 border-b border-[--border]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full mt-2" />
            <Skeleton className="h-3 w-3/4 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
