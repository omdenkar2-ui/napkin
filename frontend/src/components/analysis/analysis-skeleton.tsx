import { Skeleton } from "@/components/ui/skeleton";

export function AnalysisSkeleton() {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg overflow-hidden">
      <div className="h-10 bg-[--surface-alt]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center h-14 px-4 border-b border-[--border] last:border-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 ml-8" />
          <Skeleton className="h-4 w-20 ml-8" />
          <Skeleton className="h-4 w-20 ml-8" />
          <Skeleton className="h-5 w-20 rounded-full ml-8" />
        </div>
      ))}
    </div>
  );
}
