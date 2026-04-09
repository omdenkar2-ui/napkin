import { Skeleton } from "@/components/ui/skeleton";

export function WorkflowSkeleton() {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg overflow-hidden">
      <div className="h-10 bg-[--surface-alt]" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center h-14 px-4 border-b border-[--border] last:border-0 gap-4">
          <Skeleton className="h-4 w-40 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-7 w-7" />
        </div>
      ))}
    </div>
  );
}
