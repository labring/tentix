import { Suspense, lazy } from "react";

interface FilterParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  module?: string;
  isToday?: boolean;
  granularity?: "hour" | "day" | "month" | "year";
  limit?: string;
}

// 懒加载组件映射
const LazyComponents = {
  TicketStatusAnalysis: lazy(() => import("./ticket-status-analysis").then(m => ({ default: m.TicketStatusAnalysis }))),
  TicketTrendChart: lazy(() => import("./ticket-trend-chart").then(m => ({ default: m.TicketTrendChart }))),
  ModuleAnalysis: lazy(() => import("./module-analysis").then(m => ({ default: m.ModuleAnalysis }))),
  RatingAnalysis: lazy(() => import("./rating-analysis").then(m => ({ default: m.RatingAnalysis }))),
  KnowledgeBaseHits: lazy(() => import("./knowledge-base-hits").then(m => ({ default: m.KnowledgeBaseHits }))),
  HotIssuesAnalysis: lazy(() => import("./hot-issues-analysis").then(m => ({ default: m.HotIssuesAnalysis }))),
};

// 加载骨架屏组件
function AnalyticsSkeleton({ height = "h-80" }: { height?: string }) {
  return (
    <div className="p-4">
      <div className="animate-pulse">
        <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
        <div className={`${height} bg-zinc-200 rounded-lg`}></div>
      </div>
    </div>
  );
}

// 懒加载包装器组件
interface LazyAnalyticsWrapperProps {
  componentName: keyof typeof LazyComponents;
  filterParams?: FilterParams;
  height?: string;
}

function LazyAnalyticsWrapper({ 
  componentName, 
  filterParams, 
  height = "h-80"
}: LazyAnalyticsWrapperProps) {
  const LazyComponent = LazyComponents[componentName];

  return (
    <Suspense fallback={<AnalyticsSkeleton height={height} />}>
      <LazyComponent filterParams={filterParams} />
    </Suspense>
  );
}

// 优先级加载组件
interface PriorityAnalyticsWrapperProps {
  componentName: keyof typeof LazyComponents;
  filterParams?: FilterParams;
  priority?: "high" | "medium" | "low";
  height?: string;
}

export function PriorityAnalyticsWrapper({ 
  componentName, 
  filterParams, 
  priority = "medium",
  height = "h-80"
}: PriorityAnalyticsWrapperProps) {
  // 根据优先级决定是否立即加载
  const shouldLoadImmediately = priority === "high";
  
  if (shouldLoadImmediately) {
    const LazyComponent = LazyComponents[componentName];
    return (
      <Suspense fallback={<AnalyticsSkeleton height={height} />}>
        <LazyComponent filterParams={filterParams} />
      </Suspense>
    );
  }

  // 低优先级组件延迟加载
  return (
    <div className="min-h-[400px]">
      <LazyAnalyticsWrapper 
        componentName={componentName} 
        filterParams={filterParams} 
        height={height}
      />
    </div>
  );
}
