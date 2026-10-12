import { AppPageHeading } from "@/components/app/app-page-header";
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <>
      <AppPageHeading>
        <Skeleton className="h-8 w-64" />
      </AppPageHeading>
      <div className="flex flex-col gap-6" aria-label="Loading workspace">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  );
}
