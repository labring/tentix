import { useState } from "react";
import { moduleAnalysisQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";

interface ModuleAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

export function ModuleAnalysis({ filterParams, isLoading: externalLoading }: ModuleAnalysisProps) {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { data: rawData } = useSuspenseQuery(moduleAnalysisQueryOptions(filterParams));

  const isLoading = externalLoading;

  const moduleData = rawData?.moduleDistribution || [];
  
  const total = moduleData.reduce((sum, item) => sum + item.value, 0);

  const data = moduleData
    .map((item) => ({
      name: item.name || t("uncategorized"),
      value: item.value,
      percentage: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="h-96 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">{t("module_analysis")}</h2>
          <div className="flex items-center justify-center h-64 text-zinc-500">
            {t("no_data")}
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));

  return (
    <div className="w-full max-w-none min-w-0 px-0 mx-0">
      <div className="mb-0">
        <div className="bg-white border border-zinc-200 rounded-t-lg flex h-16 p-6 justify-between items-center flex-shrink-0 self-stretch shadow-sm">
          <h2 className="text-xl  text-zinc-900">{t("module_analysis")}</h2>
        </div>
      </div>

      <div className="bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-8">
         <div className="relative max-h-96 overflow-y-auto overflow-x-visible scrollbar-thin scrollbar-track-zinc-100 scrollbar-thumb-zinc-300 pt-0">
          <div className="space-y-4">
            {data.map((item, index) => {
              const widthPercentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              
              const blueColors = [
                "#1D4ED8", 
                "#2563EB",
                "#3B82F6",
                "#60A5FA", 
              ];
              
              const bgColor = blueColors[Math.min(index, blueColors.length - 1)];
              const isHovered = hoveredIndex === index;
              
              const isTopItem = index < 1;
              
              return (
                <div 
                  key={index} 
                  className="relative cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* 条形容器 */}
                  <div className="relative h-12 rounded-lg overflow-visible">
                    {/* 条形背景 */}
                    <div
                      className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out rounded-lg z-10 ${
                        isHovered ? 'opacity-90 scale-x-[1.02]' : 'opacity-100 scale-x-100'
                      }`}
                      style={{
                        width: `${Math.max(widthPercentage * 0.8, 15)}%`,
                        backgroundColor: bgColor,
                      }}
                    />
                    
                    {/* 模块名称 */}
                    <div 
                      className="absolute top-0 left-0 h-full flex items-center px-4 z-20"
                      style={{
                        width: `${Math.max(widthPercentage * 0.8, 15)}%`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px] transition-colors duration-300 ${
                          widthPercentage > 50 ? "text-white" : "text-gray-700"
                        }`}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* 数值和百分比 - 显示在颜色条形旁边 */}
                    <div 
                      className="absolute top-1/2 left-0 transform -translate-y-1/2 ml-3 z-30"
                      style={{
                        left: `${Math.max(widthPercentage * 0.8, 15)}%`,
                      }}
                    >
                      <span className="text-gray-700 text-sm  whitespace-nowrap">
                        {item.value} | {item.percentage}%
                      </span>
                    </div>
                  </div>

                   {/* Hover 提示框*/}
                   {isHovered && (
                     <div
                       className={`absolute left-1/2 transform -translate-x-1/2 bg-white text-gray-700 w-[240px] p-4 flex flex-col justify-center items-start gap-2 rounded-xl border border-zinc-200 z-[1000] pointer-events-none shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ${
                         isTopItem ? "top-[calc(100%+10px)]" : "-top-12"
                       }`}
                     >
                      <div className="flex items-center gap-2 w-full">
                        {/* 蓝色小竖线 */}
                        <div className="w-1 self-stretch rounded-sm bg-blue-600" />
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm text-zinc-900 font-medium">{item.name}</span>
                          <span className="text-sm text-zinc-900 ">
                            {item.value} | {item.percentage}%
                          </span>
                        </div>
                      </div>
                       {/* 箭头指示器 */}
                       <div
                         className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 ${
                           isTopItem 
                             ? 'top-[-4px] border-b-4 border-b-white' 
                             : 'bottom-[-4px] border-t-4 border-t-white'
                         }`}
                       />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}