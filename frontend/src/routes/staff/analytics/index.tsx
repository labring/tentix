import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsFilter } from "@comp/staff/tickets-analytics/analytics-filter";
import { PriorityAnalyticsWrapper } from "@comp/staff/tickets-analytics/lazy-analytics-wrapper";
import { StaffSidebar } from "@comp/staff/sidebar";
import { RouteTransition } from "@comp/page-transition";
import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface FilterParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}

export const Route = createFileRoute("/staff/analytics/")({
  component: AnalyticsDashboard,
});

function AnalyticsSkeleton() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">正在加载数据分析...</p>
      </div>
    </div>
  );
}

function AnalyticsDashboard() {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(() => 
    new Date().toLocaleTimeString("zh-CN", { 
      hour: "2-digit", 
      minute: "2-digit" 
    })
  );
  const [filterParamsState, setFilterParamsState] = useState<FilterParams>({
    isToday: false,
  });
  const [loadSecondaryComponents, setLoadSecondaryComponents] = useState(false);

  // 使用 useMemo 稳定 filterParams 对象引用，避免不必要的重新查询
  // 只有当实际值改变时才创建新对象
  const filterParams = useMemo(() => {
    return {
      startDate: filterParamsState.startDate,
      endDate: filterParamsState.endDate,
      agentId: filterParamsState.agentId,
      isToday: filterParamsState.isToday,
    };
  }, [
    filterParamsState.startDate,
    filterParamsState.endDate,
    filterParamsState.agentId,
    filterParamsState.isToday,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadSecondaryComponents(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange: { from: Date; to: Date } | undefined) => {
    const convertDateToTimestampRange = (date: Date, isEndDate: boolean = false) => {
      const newDate = new Date(date);
      if (isEndDate) {
        newDate.setHours(23, 59, 59, 999);
      } else {
        newDate.setHours(0, 0, 0, 0);
      }
      return newDate.toISOString();
    };

    // 使用函数式更新，避免依赖 filterParams
    setFilterParamsState((prev) => ({
      ...prev,
      startDate: newDateRange?.from ? convertDateToTimestampRange(newDateRange.from, false) : undefined,
      endDate: newDateRange?.to ? convertDateToTimestampRange(newDateRange.to, true) : undefined,
      isToday: false,
    }));
  }, []);

  const handleEmployeeChange = useCallback((employeeId: string) => {
    // 使用函数式更新，避免依赖 filterParams
    setFilterParamsState((prev) => ({
      ...prev,
      agentId: employeeId,
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["ticketTrends"],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["ticketStatusAnalysis"],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["moduleAnalysis"],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["ratingAnalysis"],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["knowledgeBaseHits"],
      refetchType: "all",
    });
    queryClient.invalidateQueries({
      queryKey: ["hotIssuesAnalysis"],
      refetchType: "all",
    });
    
    // 更新显示时间
    setLastUpdated(new Date().toLocaleTimeString("zh-CN", { 
      hour: "2-digit", 
      minute: "2-digit" 
    }));
  }, [queryClient]);

  const handleTodayToggle = useCallback((todayChecked: boolean) => {
    // 使用函数式更新，避免依赖 filterParams
    setFilterParamsState((prev) => {
      if (todayChecked) {
        const today = new Date();
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        
        return {
          ...prev,
          isToday: true,
          startDate: startOfToday.toISOString(),
          endDate: endOfToday.toISOString(),
        };
      } else {
        return {
          ...prev,
          isToday: false,
          startDate: undefined,
          endDate: undefined,
        };
      }
    });
  }, []);

  return (
    <RouteTransition>
      <div className="flex h-screen w-full overflow-hidden">
        <StaffSidebar />
        <div className="flex-1 overflow-auto bg-zinc-50">
          <Suspense fallback={<AnalyticsSkeleton />}>
            <div className="w-full flex flex-col pt-6 px-6 pb-6 gap-[15px]">
              {/* 筛选组件 */}
              <AnalyticsFilter
                onDateRangeChange={handleDateRangeChange}
                onEmployeeChange={handleEmployeeChange}
                onRefresh={handleRefresh}
                onTodayToggle={handleTodayToggle}
                lastUpdated={lastUpdated}
              />
              
              <PriorityAnalyticsWrapper
                componentName="TicketStatusAnalysis"
                filterParams={filterParams}
                priority="high"
                height="h-64"
              />
              
              <PriorityAnalyticsWrapper
                componentName="TicketTrendChart"
                filterParams={filterParams}
                priority="high"
                height="h-120"
              />
              
              {loadSecondaryComponents && (
                <>
                  <PriorityAnalyticsWrapper
                    componentName="ModuleAnalysis"
                    filterParams={filterParams}
                    priority="medium"
                    height="h-96"
                  />
                  
                  <PriorityAnalyticsWrapper
                    componentName="RatingAnalysis"
                    filterParams={filterParams}
                    priority="medium"
                    height="h-96"
                  />
                </>
              )}
              
              {loadSecondaryComponents && (
                <>
                  <PriorityAnalyticsWrapper
                    componentName="KnowledgeBaseHits"
                    filterParams={filterParams}
                    priority="low"
                    height="h-96"
                  />
                  
                  <PriorityAnalyticsWrapper
                    componentName="HotIssuesAnalysis"
                    filterParams={filterParams}
                    priority="low"
                    height="h-96"
                  />
                </>
              )} 
            </div>
          </Suspense>
        </div>
      </div>
    </RouteTransition>
  );
}
