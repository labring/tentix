import { Skeleton } from "tentix-ui"
 
export function SkeletonTable() {
  return (
    <div className="flex flex-col gap-6 mx-6">
      <Skeleton className="w-[428px] h-[40px]" />
      <div className="overflow-hidden rounded-lg w-full">
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}