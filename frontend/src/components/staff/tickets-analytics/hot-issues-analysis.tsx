import { Badge, cn } from "tentix-ui";
import { TrendingUp, TrendingDown, Minus, Sparkles, BarChartBig, AlertCircle } from "lucide-react";
import { hotIssuesQueryOptions } from "@lib/analytics-query";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "i18n";

interface HotIssue {
  id: number;
  tag: string;
  description?: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidence: number;
}

interface TagStat {
  tag: string;
  description?: string;
  count: number;
  percentage: number;
}

interface AIInsights {
  keyFindings: string[];
  improvements: string[];
  strategy: string;
}

interface HotIssuesData {
  topIssues: HotIssue[];
  tagStats: TagStat[];
  totalIssues: number;
  timeRange: string;
  aiInsights?: AIInsights;
}

interface HotIssuesAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    limit?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

//热点问题分析
export function HotIssuesAnalysis({ filterParams, isLoading: externalLoading }: HotIssuesAnalysisProps) {
  const { t } = useTranslation();
  const { data: rawData, isLoading: queryLoading, error, isError } = useQuery(
    hotIssuesQueryOptions(filterParams)
  );
  
  const isLoading = externalLoading || queryLoading;
  
  // 错误状态-不阻塞其他组件
  if (isError) {
    console.error('Hot issues API error:', error);
    const isTimeout = error instanceof Error && (
      error.message.includes("timeout") || 
      error.message.includes("超时") ||
      error.message.includes("timed out")
    );
    
    return (
      <div className="w-full bg-white rounded-lg border border-orange-200 shadow-sm">
        <div className="flex h-16 p-6 justify-between items-center flex-shrink-0 border-b border-orange-200">
          <h2 className="text-xl text-zinc-900 flex items-center gap-2">
            {t("hot_issues_analysis")}
          </h2>
        </div>
        <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <AlertCircle className="h-12 w-12 text-orange-500" />
          <div className="text-center max-w-md">
            <p className="text-base font-medium text-zinc-900 mb-2">
              {isTimeout 
                ? (t("request_timeout"))
                : (t("data_loading_failed"))
              }
            </p>
            <p className="text-sm text-zinc-600 mb-4">
              {isTimeout 
                ? (t("request_timeout_message"))
                : (error instanceof Error ? error.message : (t("network_error_message")))
              }
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              {t("retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  //加载中或数据为空
  if (!rawData || isLoading) {
    return (
      <div className="w-full">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-zinc-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-zinc-200 rounded w-32"></div>
          </div>
        </div>
        <div className="bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-zinc-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  //检查响应格式错误
  if ('message' in rawData) {
    console.error('Hot issues API error:', rawData.message);
    return (
      <div className="w-full bg-white rounded-lg border border-orange-200">
        <div className="flex h-16 p-6 justify-between items-center flex-shrink-0 border-b border-orange-200">
          <h2 className="text-xl text-zinc-900 flex items-center gap-2">
            {t("hot_issues_analysis")}
          </h2>
        </div>
        <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
          <AlertCircle className="h-12 w-12 text-orange-500" />
          <div className="text-center">
            <p className="text-base font-medium text-zinc-900 mb-2">
              {t("data_error")}
            </p>
            <p className="text-sm text-zinc-600">{rawData.message}</p>
          </div>
        </div>
      </div>
    );
  }
  
  const sortedTagStats = [...(rawData.tagStats || [])].sort((a, b) => b.count - a.count).slice(0, 6);
  
  const data: HotIssuesData = {
    topIssues: (rawData.topIssues || []) as HotIssue[],
    tagStats: sortedTagStats,
    totalIssues: rawData.totalIssues || 0,
    timeRange: filterParams?.isToday ? t("today") : t("last_7_days"),
    aiInsights: rawData.aiInsights
  };
  //计算标签问题数量最大值
  const maxCount = Math.max(...data.tagStats.map(s => s.count), 0);
  let dynamicYAxisMax = 100;
  let yAxisStep = 20;
  
  if (maxCount > 100) {
    dynamicYAxisMax = Math.ceil(maxCount / 20) * 20;
    if (dynamicYAxisMax > 200) {
      yAxisStep = 50;
      dynamicYAxisMax = Math.ceil(maxCount / 50) * 50;
    } else {
      yAxisStep = 20;
    }
  }
  dynamicYAxisMax = Math.max(100, dynamicYAxisMax);
  
  const numYAxisLabels = Math.floor(dynamicYAxisMax / yAxisStep) + 1;

  //整理趋势图标
  const getTrendIcon = (trend: string, priority: string) => {
    if (priority === 'P1') {
      switch (trend) {
        case 'up':
          return <TrendingUp className="h-4 w-4 text-green-500" />;
        case 'down':
          return <TrendingDown className="h-4 w-4 text-green-500" />;
        default:
          return <Minus className="h-4 w-4 text-green-500" />;
      }
    }
    
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'P1':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'P2':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'P3':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRankNumberColor = (index: number) => {
    switch (index) {
      case 0: 
        return 'text-blue-600';
      case 1: 
        return 'text-blue-500';
      case 2: 
        return 'text-blue-400';
      default: 
        return 'text-zinc-400';
    }
  };

  const displayedIssues = data.topIssues.slice(0, 5);
  //加载中
  if (isLoading) {
    return (
      <div className="w-full">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-zinc-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-zinc-200 rounded w-32"></div>
          </div>
        </div>
        <div className="bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-zinc-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  
  return (
    //热点问题分析
    <div className="w-full bg-white rounded-lg border border-gray-200">
      <div className="flex h-16 p-6 justify-between items-center flex-shrink-0 border-b border-gray-200">
        <h2 className="text-xl  text-zinc-900 flex items-center gap-2">
          {t("hot_issues_analysis")}
        </h2>
      </div>

      {/* 热点问题列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col p-8 items-start gap-4 flex-1 border-r border-gray-200">
          <h3 className="text-base text-black">{t("top_popular_issues")}</h3>
          <div className="flex flex-col gap-4 w-full">
            {displayedIssues.map((issue, index) => {
              const blueGradient = [
                'bg-blue-50',
                'bg-blue-50/80',
                'bg-blue-50/60',
                'bg-blue-50/40',
                'bg-blue-50/20',
              ];
              const bgColor = blueGradient[index] || 'bg-white';
              
              //热点问题项
              return (
                <div
                  key={issue.id}
                  className={cn("flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-blue-100/50 transition-colors", bgColor)}
                >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className={cn("flex items-center justify-center w-8 text-sm font-medium leading-normal", getRankNumberColor(index))}
                    style={{ fontFamily: '"PingFang SC"', letterSpacing: '0.1px' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <div className="flex-1 min-w-0">
                    {issue.description && (
                      <p className="text-sm font-normal leading-normal text-zinc-900 mb-1">
                        {issue.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <p className="text-xs font-normal leading-normal text-zinc-700">
                        {issue.tag}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 趋势和优先级 */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-lg  text-zinc-900">
                    {getTrendIcon(issue.trend, issue.priority)}
                    <span>{issue.count}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getPriorityColor(issue.priority))}
                  >
                    {issue.priority}
                  </Badge>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* 标签问题数量 */}
        <div className="p-8">
          <h3 className="text-base  mb-4">{t("tag_issue_count")}</h3>

           {/* 标签问题数量图表 */}
           <div className="h-80 relative">
             <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-zinc-500">
               {Array.from({ length: numYAxisLabels }, (_, i) => {
                 const value = (numYAxisLabels - 1 - i) * yAxisStep;
                 return (
                   <div key={i} className="flex items-center justify-end">
                     <span className="text-right">{value}</span>
                   </div>
                 );
               })}
             </div>

             <div className="ml-12 h-full border-l border-b border-zinc-200 relative">
               {Array.from({ length: numYAxisLabels }, (_, i) => (
                 <div
                   key={i}
                   className="absolute w-full border-t border-zinc-100"
                   style={{ bottom: `${(i / (numYAxisLabels - 1)) * 100}%` }}
                 />
               ))}

              <div className="absolute left-0 right-0 bottom-0 h-full flex items-end justify-around px-4 gap-2">
                {data.tagStats.map((stat, index) => {
                  const blueShades = [
                    '#1D4ED8',
                    '#2563EB',
                    '#3B82F6',
                    '#60A5FA',
                    '#93c5fd',
                    '#93C5FD',
                    '#BFDBFE',
                  ];
                  const barColor = blueShades[Math.min(index, blueShades.length - 1)];
                  
                   const heightPercent = (stat.count / dynamicYAxisMax) * 100;
                   const barHeight = Math.max((heightPercent / 100) * 300, 10);

                   //标签问题数量项
                   return (
                     <div
                       key={stat.tag}
                       className="flex-1 flex flex-col items-center justify-end group max-w-[80px]"
                     >
                       <div className="relative w-full flex flex-col items-center">
                         <div className="text-sm  text-zinc-700 mb-1">
                           {stat.count}
                         </div>
                         
                         <div
                           className="w-full rounded-t-lg transition-all duration-300 relative"
                           style={{
                             height: `${barHeight}px`,
                             backgroundColor: barColor
                           }}
                         >
                           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                             <div className="flex items-center gap-2 bg-white rounded-lg px-5 py-2 shadow-lg border border-gray-200">
                               <div className="w-1 h-4 rounded-full" style={{ backgroundColor: barColor }}></div>
                               <span className="text-sm font-medium text-zinc-900">{stat.tag}</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
             
             {/* 标签问题数量标签 */}
             <div className="ml-12 mt-2 flex justify-around px-4 gap-2">
               {data.tagStats.map((stat) => (
                 <div
                   key={stat.tag}
                   className="text-xs text-zinc-600 text-center leading-tight px-1 max-w-[80px]"
                 >
                   {stat.tag}
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {/* 智能分析洞察 */}
      <div className="border-t border-gray-200 flex flex-col w-full items-start flex-shrink-0">
        <div className="flex flex-col py-6 px-8 pb-8 items-start gap-[10px] self-stretch w-full">
          <h2 className="text-xl text-black flex items-center gap-2">
            {t("intelligent_analysis_insights")}
            <Sparkles className="h-5 w-5 text-blue-500" />
          </h2>
          
          {/* 如果 AI 洞察不可用，显示友好的错误提示 */}
          {!data.aiInsights ? (
            <div className="w-full bg-orange-50 border border-orange-200 rounded-lg p-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900 mb-1">
                  {t("ai_insights_unavailable")}
                </p>
                <p className="text-sm text-orange-700">
                  {t("ai_insights_timeout_message")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 关键发现 */}
              <div className="flex flex-col gap-[10px]">
                <h3 className="text-base text-zinc-900 flex items-center gap-2">
                  {t("key_findings")}
                </h3>
                <ul className="flex flex-col gap-0">
                  {(data.aiInsights.keyFindings || []).map((finding, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm font-normal leading-normal text-zinc-600">
                      <span className="text-zinc-600 text-lg">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 改进建议 */}
              <div className="flex flex-col gap-[10px]">
                <h3 className="text-base text-zinc-900 flex items-center gap-2">
                  {t("improvement_suggestions")}
                </h3>
                <ul className="flex flex-col gap-0">
                  {(data.aiInsights.improvements || []).map((improvement, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm font-normal leading-normal text-zinc-600">
                      <span className="text-zinc-600 text-lg">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 数据驱动策略 */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 w-full">
                <h3 className="text-base text-zinc-900 flex items-center gap-2">
                  <BarChartBig className="h-4 w-4 text-blue-500" />
                  {t("data_driven_strategy")}
                </h3>
                <p className="text-sm font-normal leading-normal text-zinc-900">
                  {data.aiInsights.strategy || t("analyzing_data")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
