import { Skeleton } from "tentix-ui";

export function SettingsSkeleton() {
  return (
    <div className="flex-1 min-w-0 p-5 pt-0">
      {/* 顶部标题区（与实际 header 对齐，保持留白） */}
      <div className="h-4 mb-4" />

      <div className="space-y-6">
        {/* 头像与说明区骨架 */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        {/* 分隔线占位 */}
        <Skeleton className="h-[1px] w-full" />

        {/* 信息网格区骨架（两列） */}
        <div className="grid grid-cols-2 gap-6 max-w-3xl">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>

        {/* 表格/列表占位（用于用户管理等场景） */}
        <div className="space-y-3 max-w-5xl">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="rounded-xl border p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


