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
        <div className="bg-white border border-zinc-200 rounded-t-lg p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">{t("module_analysis")}</h2>
        </div>
      </div>

      <div className="bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-6">
         <div 
           className="relative" 
           style={{ 
             maxHeight: "384px", 
             overflowY: "auto",  
             overflowX: "visible", 
             scrollbarWidth: "thin",
             scrollbarColor: "#d4d4d8 #f4f4f5",
             paddingTop: "0px"
           }}
         >
          <div className="space-y-4">
            {data.map((item, index) => {
              const widthPercentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              
              const blueColors = [
                "#1e40af", 
                "#2563eb",
                "#3b82f6",
                "#60a5fa", 
              ];
              
              const bgColor = blueColors[Math.min(index, blueColors.length - 1)];
              const isHovered = hoveredIndex === index;
              
              const isTopItem = index < 1;
              
              return (
                <div 
                  key={index} 
                  className="relative"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* 条形容器 */}
                  <div 
                    className="relative"
                    style={{
                      height: "48px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      overflow: "visible",
                    }}
                  >
                    {/* 条形背景 */}
                    <div
                      className="transition-all duration-500 ease-out"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${Math.max(widthPercentage * 0.8, 15)}%`, 
                        backgroundColor: bgColor,
                        opacity: isHovered ? 0.9 : 1,
                        transform: isHovered ? "scaleX(1.02)" : "scaleX(1)",
                        transformOrigin: "left",
                        borderRadius: "8px",
                        zIndex: 1,
                      }}
                    />
                    
                    {/* 模块名称 */}
                    <div 
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${Math.max(widthPercentage * 0.8, 15)}%`,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 16px",
                        zIndex: 2,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {/* 蓝色小竖线 */}
                        <div 
                          style={{
                            width: "3px",
                            height: "14px",
                            backgroundColor: bgColor,
                            borderRadius: "1px",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{
                          color: widthPercentage > 50 ? "white" : "#374151",
                          fontWeight: 500,
                          fontSize: "14px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                          transition: "color 0.3s",
                        }}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* 数值和百分比 - 显示在颜色条形旁边 */}
                    <div 
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: `${Math.max(widthPercentage * 0.8, 15)}%`,
                        transform: "translateY(-50%)",
                        marginLeft: "12px",
                        zIndex: 3,
                      }}
                    >
                      <span style={{
                        color: "#374151",
                        fontSize: "14px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>
                        {item.value} | {item.percentage}%
                      </span>
                    </div>
                  </div>

                   {/* Hover 提示框*/}
                   {isHovered && (
                     <div
                       style={{
                         position: "absolute",
                         top: isTopItem ? "calc(100% + 10px)" : "-50px",
                         left: "50%",
                         transform: "translateX(-50%)",
                         backgroundColor: "white",
                         color: "#374151",
                         padding: "12px 16px",
                         borderRadius: "8px",
                         fontSize: "12px",
                         whiteSpace: "nowrap",
                         zIndex: 1000, 
                         pointerEvents: "none",
                         boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                         border: "1px solid #e5e7eb",
                       }}
                     >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {/* 蓝色小竖线 */}
                        <div 
                          style={{
                            width: "3px",
                            height: "14px",
                            backgroundColor: bgColor,
                            borderRadius: "1px",
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <span style={{ fontWeight: 700, color: "#000000", marginRight: "13px" }}>{item.name}</span>
                          <span style={{ fontSize: "11px", color: "#000000", fontWeight: 600 }}>
                            {item.value} | {item.percentage}%
                          </span>
                        </div>
                      </div>
                       {/* 箭头指示器 */}
                       <div
                         style={{
                           position: "absolute",
                           [isTopItem ? 'top' : 'bottom']: "-4px",
                           left: "50%",
                           transform: "translateX(-50%)",
                           width: 0,
                           height: 0,
                           borderLeft: "4px solid transparent",
                           borderRight: "4px solid transparent",
                           [isTopItem ? 'borderBottom' : 'borderTop']: "4px solid white",
                         }}
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