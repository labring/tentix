import { Skeleton } from "tentix-ui"
 
export function SkeletonTable() {
  return (
    <div className="h-full flex flex-1 flex-col min-w-0 bg-zinc-50">
      {/* Header Skeleton - 匹配实际的 h-24 header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 h-24 bg-zinc-50">
        {/* 左侧状态筛选按钮 skeleton */}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>

        {/* 右侧搜索和创建按钮 skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      {/* Content Area Skeleton */}
      <div className="flex-1 min-h-0 flex flex-col px-4 lg:px-6 pb-4 gap-3">
        {/* Table Header Skeleton */}
        <div className="flex-shrink-0 bg-white rounded-lg border border-zinc-200">
          <div className="flex items-center px-6 h-10 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>

        {/* Table Body Skeleton */}
        <div className="flex-1 min-h-0 bg-white border border-zinc-200 rounded-xl mt-3">
          <div className="p-6 space-y-0">
            {/* Table rows skeleton */}
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className={`flex items-center h-14 gap-4 ${index < 7 ? 'border-b border-zinc-200' : ''}`}>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}