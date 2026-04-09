import { Skeleton } from "@/components/ui/skeleton";

export function IntegrationsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[--surface] border border-[--border] rounded-lg p-5 min-h-[160px] flex flex-col">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-28 mt-3" />
          <Skeleton className="h-3 w-full mt-2" />
          <Skeleton className="h-3 w-3/4 mt-1" />
          <div className="flex justify-between items-center mt-auto pt-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
