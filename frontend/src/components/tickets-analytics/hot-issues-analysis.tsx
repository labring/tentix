import { Badge, cn } from "tentix-ui";
import { TrendingUp, TrendingDown, Minus, Sparkles, BarChart3 } from "lucide-react";
import { hotIssuesQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";

interface HotIssue {
  id: number;
  category: string;
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidence: number;
}

interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

interface AIInsights {
  keyFindings: string[];
  improvements: string[];
  strategy: string;
}

interface HotIssuesData {
  topIssues: HotIssue[];
  categoryStats: CategoryStat[];
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

export function HotIssuesAnalysis({ filterParams, isLoading: externalLoading }: HotIssuesAnalysisProps) {
  const { t } = useTranslation();
  const { data: rawData } = useSuspenseQuery(hotIssuesQueryOptions(filterParams));
  
  const sortedCategoryStats = [...(rawData.categoryStats || [])].sort((a, b) => b.count - a.count).slice(0, 6);
  
  const data: HotIssuesData = {
    topIssues: (rawData.topIssues || []) as HotIssue[],
    categoryStats: sortedCategoryStats,
    totalIssues: rawData.totalIssues || 0,
    timeRange: filterParams?.isToday ? t("today") : t("last_7_days"),
    aiInsights: rawData.aiInsights
  };
  
  const isLoading = externalLoading;

  const maxCount = Math.max(...data.categoryStats.map(s => s.count), 0);
  
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

  const displayedIssues = data.topIssues.slice(0, 5);

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
    <div className="w-full bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
          {t("top_popular_issues")}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="p-6 border-r border-gray-200">
          <h3 className="text-base font-semibold mb-4">{t("top_popular_issues")}</h3>
          <div className="space-y-2">
            {displayedIssues.map((issue, index) => {
              const blueGradient = [
                'bg-blue-50',
                'bg-blue-50/80',
                'bg-blue-50/60',
                'bg-blue-50/40',
                'bg-blue-50/20',
              ];
              const bgColor = blueGradient[index] || 'bg-white';
              
              return (
                <div
                  key={issue.id}
                  className={cn("flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-blue-100/50 transition-colors", bgColor)}
                >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 font-semibold text-sm text-black">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight text-zinc-900 mb-1">
                      {issue.tag}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="text-xs text-zinc-600">{issue.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-lg font-semibold text-zinc-900">
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

        <div className="p-6">
          <h3 className="text-base font-semibold mb-6">{t("category_issue_count")}</h3>

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
                {data.categoryStats.map((stat, index) => {
                  const blueShades = [
                    '#1e40af',
                    '#2563eb',
                    '#3b82f6',
                    '#60a5fa',
                    '#93c5fd',
                    '#bfdbfe',
                    '#dbeafe',
                  ];
                  const barColor = blueShades[Math.min(index, blueShades.length - 1)];
                  
                   const heightPercent = (stat.count / dynamicYAxisMax) * 100;
                   const barHeight = Math.max((heightPercent / 100) * 300, 10);

                   return (
                     <div
                       key={stat.category}
                       className="flex-1 flex flex-col items-center justify-end group"
                       style={{ maxWidth: '80px' }}
                     >
                       <div className="relative w-full flex flex-col items-center">
                         <div className="text-sm font-semibold text-zinc-700 mb-1">
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
                               <span className="text-sm font-medium text-zinc-900">{stat.category}</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
             
             <div className="ml-12 mt-2 flex justify-around px-4 gap-2">
               {data.categoryStats.map((stat) => (
                 <div
                   key={stat.category}
                   className="text-xs text-zinc-600 text-center leading-tight max-w-full px-1"
                   style={{ maxWidth: '80px' }}
                 >
                   {stat.category}
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      <div className="border-t border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            {t("intelligent_analysis_insights")}
            <Sparkles className="h-5 w-5 text-blue-500" />
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              {t("key_findings")}
            </h3>
            <ul className="space-y-2">
              {(data.aiInsights?.keyFindings || []).map((finding, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="text-black text-lg">•</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              {t("improvement_suggestions")}
            </h3>
            <ul className="space-y-2">
              {(data.aiInsights?.improvements || []).map((improvement, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="text-black text-lg">•</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              {t("data_driven_strategy")}
            </h3>
              <p className="text-sm text-zinc-700 leading-relaxed">
                {data.aiInsights?.strategy || t("analyzing_data")}
              </p>
            </div>
        </div>
      </div>
    </div>
  );
}
