import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "tentix-ui";
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { knowledgeHitsQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

const ZONE_COLORS = {
  high_efficiency: "#10B981", 
  potential: "#3B82F6", 
  need_optimization: "#FCD34D", 
  low_efficiency: "#9CA3AF", 
};

interface ZoneLabelsOverlayProps {
  xAxisMax: number;
  yAxisMax: number;
  hitRateThreshold: number;
  accessThreshold: number;
  t: any;
  width: number;
  height: number;
}

const ZoneLabelsOverlay = ({ xAxisMax, yAxisMax, hitRateThreshold, accessThreshold, t, width, height }: ZoneLabelsOverlayProps) => {
  const chartPadding = { left: 50, right: 20, top: 30, bottom: 50 };
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;
  
  const xScale = chartWidth / xAxisMax;
  const yScale = chartHeight / yAxisMax;
  
  const toPixelY = (dataY: number) => {
    return chartPadding.top + chartHeight - (dataY * yScale);
  };
  
  const intersectionX = chartPadding.left + accessThreshold * xScale;
  const intersectionY = toPixelY(hitRateThreshold);
  
  const rectWidth = 160;
  const rectHeight = 48;
  
  const labelSpacing = 15;
  
  const spacingFromCenter = rectWidth / 2 + labelSpacing / 2;
  
  const highEffX = intersectionX + spacingFromCenter;
  const highEffY = intersectionY - spacingFromCenter;
  
  const potentialX = intersectionX - spacingFromCenter;
  const potentialY = intersectionY - spacingFromCenter;
  
  const needOptX = intersectionX + spacingFromCenter;
  const needOptY = intersectionY + spacingFromCenter;
  
  const lowEffX = intersectionX - spacingFromCenter;
  const lowEffY = intersectionY + spacingFromCenter;
  
  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--typography-font-family-font-sans, Geist)',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '16px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 10,
    color: 'rgb(24, 24, 27)',
  };
  
  const descStyle: React.CSSProperties = {
    fontFamily: 'var(--typography-font-family-font-sans, Geist)',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '16px',
    pointerEvents: 'none',
    whiteSpace: 'normal',
    zIndex: 10,
    wordBreak: 'break-word',
    color: 'rgb(113, 113, 122)',
  };
  
  const labels = [
    {
      key: 'potential',
      baseX: potentialX,
      baseY: potentialY,
      color: ZONE_COLORS.potential,
      title: t("potential_zone"),
      description: t("recommend_adding_guidance"),
      offsetX: 3,
      offsetY: 55,
      textAlign: 'right' as const,
    },
    {
      key: 'low_efficiency',
      baseX: lowEffX,
      baseY: lowEffY,
      color: ZONE_COLORS.low_efficiency,
      title: t("low_efficiency_zone"),
      description: t("recommend_updating_content"),
      offsetX: 3,
      offsetY: -60,
      textAlign: 'right' as const,
    },
    {
      key: 'high_efficiency',
      baseX: highEffX,
      baseY: highEffY,
      color: ZONE_COLORS.high_efficiency,
      title: t("high_efficiency_zone"),
      description: t("maintain_and_promote_content"),
      offsetX: -1,
      offsetY: 55,
      textAlign: 'left' as const,
    },
    {
      key: 'need_optimization',
      baseX: needOptX,
      baseY: needOptY,
      color: ZONE_COLORS.need_optimization,
      title: t("needs_optimization"),
      description: t("recommend_improving_accuracy"),
      offsetX: -1,
      offsetY: -60,
      textAlign: 'left' as const,
    },
  ];
  
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }
  
  if (!xAxisMax || !yAxisMax || xAxisMax <= 0 || yAxisMax <= 0) {
    return null;
  }
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {labels.map((label) => {
        const scaleX = width / 500;
        const scaleY = height / 500;
        const offsetX = (label.offsetX || 0) * scaleX;
        const offsetY = (label.offsetY || 0) * scaleY;
        
        const finalX = label.baseX + offsetX;
        const finalY = label.baseY + offsetY;
        
        const left = Math.max(0, Math.min(finalX - rectWidth / 2, width - rectWidth));
        const top = Math.max(0, Math.min(finalY - rectHeight / 2, height - rectHeight));
        
        const alignItems = label.textAlign === 'right' ? 'flex-end' : 'flex-start';
        
        return (
          <div
            key={label.key}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${rectWidth}px`,
              height: `${rectHeight}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems,
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              padding: '4px 8px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                ...titleStyle,
                textAlign: label.textAlign,
                marginBottom: '4px',
              }}
            >
              {label.title}
            </div>
            <div
              style={{
                ...descStyle,
                textAlign: label.textAlign,
              }}
            >
              {label.description}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface FilterParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  isToday?: boolean;
}

interface KnowledgeBaseHitsProps {
  filterParams?: FilterParams;
  isLoading?: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  accessCount: number;
  hitRate: number;
  zone: "high_efficiency" | "potential" | "need_optimization" | "low_efficiency";
}

export function KnowledgeBaseHits({
  filterParams = {},
  isLoading: externalLoading = false,
}: KnowledgeBaseHitsProps) {
  const { t } = useTranslation();
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [chartSize, setChartSize] = useState({ width: 500, height: 500 });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 6; 

  const { data } = useSuspenseQuery(knowledgeHitsQueryOptions(filterParams));

  const loading = externalLoading;

  useEffect(() => {
    const updateSize = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setChartSize({ width: rect.width, height: rect.height });
        }
      }
    };

    const timer = setTimeout(updateSize, 100);
    
    const resizeObserver = new ResizeObserver(updateSize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }
    
    window.addEventListener('resize', updateSize);
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-zinc-200 rounded-lg"></div>
            <div className="h-96 bg-zinc-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const scatterData = data.bubbleData || [];
  
  const hitRateThreshold = data.metrics?.hitRateThreshold || 50;
  
  const maxHitRate = Math.max(...scatterData.map(d => d.hitRate), 100);
  const yAxisMax = Math.ceil(maxHitRate / 10) * 10;
  
  const maxAccessCount = Math.max(...scatterData.map(d => d.accessCount), 100);
  const xAxisMax = Math.ceil(maxAccessCount / 10) * 10;
  const accessThreshold = xAxisMax / 2;

  const bubbleData = scatterData.map(item => ({
    ...item,
    z: item.accessCount,
  }));

  const classifiedData = bubbleData.map((item) => {
    const isHighHitRate = item.hitRate > hitRateThreshold;
    const isHighAccess = item.accessCount > accessThreshold;
    const zone = isHighHitRate
      ? (isHighAccess ? "high_efficiency" : "potential")
      : (isHighAccess ? "need_optimization" : "low_efficiency");
    return { ...item, zone } as KnowledgeItem & { z: number };
  });

  const zoneGroupsLocal = {
    high_efficiency: classifiedData.filter((i) => i.zone === "high_efficiency"),
    need_optimization: classifiedData.filter((i) => i.zone === "need_optimization"),
    potential: classifiedData.filter((i) => i.zone === "potential"),
    low_efficiency: classifiedData.filter((i) => i.zone === "low_efficiency"),
  } as const;

  const getTableData = () => {
    if (selectedZone === "all") {
      return classifiedData;
    }
    return zoneGroupsLocal[selectedZone as keyof typeof zoneGroupsLocal] || [];
  };

  const allTableData = getTableData();
  
  const totalPages = Math.ceil(allTableData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const tableData = allTableData.slice(startIndex, endIndex);
  
  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setCurrentPage(1);
  };
  
  const goToFirstPage = () => {
    setCurrentPage(1);
  };
  
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  // 简单的图表组件
  function ScatterChart({ option }: { option: EChartsOption }) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
      if (!chartRef.current) return;

      // 初始化图表
      const chart = echarts.init(chartRef.current, undefined, { renderer: 'svg' });
      chartInstanceRef.current = chart;

      // 监听窗口大小变化
      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);

      // 使用 ResizeObserver 监听容器大小变化
      const resizeObserver = new ResizeObserver(handleResize);
      if (chartRef.current) {
        resizeObserver.observe(chartRef.current);
      }

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        chart.dispose();
        chartInstanceRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (chartInstanceRef.current && option) {
        chartInstanceRef.current.setOption(option, true);
      }
    }, [option]);

    return <div ref={chartRef} className="w-full h-full" />;
  }

  // ECharts 散点图配置
  const scatterChartOption: EChartsOption = {
    grid: {
      top: 30,
      right: 20,
      bottom: 13,
      left: 20,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      name: t("access_count"),
      nameLocation: 'middle',
      nameGap: -10,
      nameTextStyle: {
        fontSize: 12,
        color: '#9CA3AF',
      },
      min: 0,
      max: xAxisMax,
      axisLine: {
        lineStyle: {
          color: '#9CA3AF',
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#6B7280',
      },
      splitLine: {
        show: false,
      }
    },
    yAxis: {
      type: 'value',
      name: `${t("hit_rate")}(%)`,
      nameLocation: 'end',
      nameGap: 20,
      nameTextStyle: {
        fontSize: 12,
        color: '#9CA3AF',
        align: 'left',
      },
      min: 0,
      max: yAxisMax,
      axisLine: {
        lineStyle: {
          color: '#9CA3AF',
        }
      },
      axisLabel: {
        fontSize: 12,
        color: '#6B7280',
      },
      splitLine: {
        show: false,
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#E4E4E7',
      borderWidth: 1,
      padding: 16,
      textStyle: {
        color: '#18181B',
        fontSize: 14,
      },
      formatter: (params: any) => {
        const item = params.data.item;
        const zoneColor = ZONE_COLORS[item.zone as keyof typeof ZONE_COLORS] || '#9CA3AF';
        return `
          <div style="min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #E4E4E7;">
              <div style="width: 8px; height: 8px; background-color: ${zoneColor}; border-radius: 0;"></div>
              <div style="font-weight: 500; color: #18181B;">${item.title}</div>
            </div>
            <div style="margin-top: 8px;">
              <div style="display: flex; align-items: center; justify-between; margin-bottom: 4px;">
                <span style="color: #52525B;">${t("access_count")}：</span>
                <span style="color: #18181B;">${item.accessCount}</span>
              </div>
              <div style="display: flex; align-items: center; justify-between;">
                <span style="color: #52525B;">${t("hit_rate")}：</span>
                <span style="color: #18181B;">${item.hitRate}%</span>
              </div>
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (data: any) => {
          // 气泡大小根据 accessCount 调整
          const minSize = 10;
          const maxSize = 40;
          const value = data[2]; // z value
          const normalized = (value - 0) / (maxAccessCount - 0 || 1);
          return minSize + normalized * (maxSize - minSize);
        },
        data: classifiedData.map(item => ({
          value: [item.accessCount, item.hitRate, item.z],
          item: item,
          itemStyle: {
            color: ZONE_COLORS[item.zone],
            opacity: 0.7,
            borderColor: '#fff',
            borderWidth: 2,
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
          scale: 1.1,
        }
      }
    ],
    graphic: [
      // 垂直参考线
      {
        type: 'line',
        shape: {
          x1: 50 + (accessThreshold / xAxisMax) * (chartSize.width - 70),
          y1: 30,
          x2: 50 + (accessThreshold / xAxisMax) * (chartSize.width - 70),
          y2: chartSize.height - 63,
        },
        style: {
          stroke: '#CBD5E1',
          lineDash: [5, 5],
          lineWidth: 1,
        },
        silent: true,
        z: 0,
      },
      // 水平参考线
      {
        type: 'line',
        shape: {
          x1: 50,
          y1: 30 + ((yAxisMax - hitRateThreshold) / yAxisMax) * (chartSize.height - 93),
          x2: chartSize.width - 20,
          y2: 30 + ((yAxisMax - hitRateThreshold) / yAxisMax) * (chartSize.height - 93),
        },
        style: {
          stroke: '#CBD5E1',
          lineDash: [5, 5],
          lineWidth: 1,
        },
        silent: true,
        z: 0,
      }
    ]
  };

  return (
    <div className="w-full">
      <div className="bg-white border border-zinc-200 rounded-t-lg flex w-full h-16 p-6 justify-between items-center flex-shrink-0 shadow-sm">
        <h2 className="text-xl  text-zinc-900">{t("knowledge_base_hit_distribution")}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-8">
        <div className=" border-zinc-200 rounded-lg p-4">
          <div className="h-[500px] relative" ref={chartContainerRef}>
            <ScatterChart option={scatterChartOption} />
            
            <ZoneLabelsOverlay
              xAxisMax={xAxisMax}
              yAxisMax={yAxisMax}
              hitRateThreshold={hitRateThreshold}
              accessThreshold={accessThreshold}
              t={t}
              width={chartSize.width}
              height={chartSize.height}
            />
          </div>
        </div>

        <div className=" border-zinc-200 rounded-lg p-4">
          <Tabs value={selectedZone} onValueChange={handleZoneChange} defaultValue="all">
            <TabsList className="flex w-full bg-white rounded-lg gap-2">
              <TabsTrigger 
                value="high_efficiency" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 py-1 px-3 flex items-center justify-center gap-2 flex-1 self-stretch"
              >
                <div className="w-2 h-2 bg-green-500"></div>
                {t("high_efficiency_zone")}
              </TabsTrigger>
              <TabsTrigger 
                value="need_optimization" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 py-1 px-3 flex items-center justify-center gap-2 flex-1 self-stretch"
              >
                <div className="w-2 h-2 bg-yellow-500"></div>
                {t("needs_optimization")}
              </TabsTrigger>
              <TabsTrigger 
                value="potential" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 py-1 px-3 flex items-center justify-center gap-2 flex-1 self-stretch"
              >
                <div className="w-2 h-2 bg-blue-500"></div>
                {t("potential_zone")}
              </TabsTrigger>
              <TabsTrigger 
                value="low_efficiency" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 py-1 px-3 flex items-center justify-center gap-2 flex-1 self-stretch"
              >
                <div className="w-2 h-2 bg-gray-500"></div>
                {t("low_efficiency_zone")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedZone} className="mt-4">
               <div className="border rounded-lg">
                <div className="overflow-hidden min-h-[360px]">
                  <Table>
                    <TableHeader className="bg-white border-b border-zinc-200">
                      <TableRow>
                        <TableHead className="w-[300px] min-w-[85px] p-4 text-muted-foreground">{t("questions")}</TableHead>
                        <TableHead className="min-w-[85px] p-4 flex-1 text-muted-foreground">{t("access_count")}</TableHead>
                        <TableHead className="min-w-[85px] p-4 flex-1 text-muted-foreground">{t("hit_rate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.length > 0 ? (
                        <>
                          {tableData.map((item) => (
                            <TableRow key={item.id} className="border-b border-zinc-200">
                              <TableCell className="w-[300px] min-w-[85px] p-4 truncate" title={item.title}>
                                {item.title}
                              </TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">{item.accessCount}</TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">{item.hitRate}%</TableCell>
                            </TableRow>
                          ))}
                          {Array.from({ length: itemsPerPage - tableData.length }).map((_, index) => (
                            <TableRow key={`empty-${index}`} className="border-b border-zinc-200">
                              <TableCell className="w-[300px] min-w-[85px] p-4">&nbsp;</TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">&nbsp;</TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">&nbsp;</TableCell>
                            </TableRow>
                          ))}
                        </>
                      ) : (
                        <>
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-zinc-500 py-8">
                              {t("no_data")}
                            </TableCell>
                          </TableRow>
                          {Array.from({ length: itemsPerPage - 1 }).map((_, index) => (
                            <TableRow key={`empty-${index}`} className="border-b border-zinc-200">
                              <TableCell className="w-[300px] min-w-[85px] p-4">&nbsp;</TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">&nbsp;</TableCell>
                              <TableCell className="min-w-[85px] p-4 flex-1">&nbsp;</TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {allTableData.length > 0 && (
                  <div className="border-t border-zinc-200 pt-4 px-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-500">
                        {t("total")}：{allTableData.length}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={goToFirstPage}
                          disabled={currentPage === 1}
                          className={`p-1 rounded transition-colors ${
                            currentPage === 1 
                              ? 'text-zinc-300 cursor-not-allowed' 
                              : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <ChevronsLeftIcon className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={goToPrevPage}
                          disabled={currentPage === 1}
                          className={`p-1 rounded transition-colors ${
                            currentPage === 1 
                              ? 'text-zinc-300 cursor-not-allowed' 
                              : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <ChevronLeftIcon className="h-4 w-4" />
                        </button>
                        <span className="px-3 py-1 text-sm text-zinc-600">
                          {currentPage} / {totalPages || 1}
                        </span>
                        <button 
                          onClick={goToNextPage}
                          disabled={currentPage >= totalPages}
                          className={`p-1 rounded transition-colors ${
                            currentPage >= totalPages 
                              ? 'text-zinc-300 cursor-not-allowed' 
                              : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={goToLastPage}
                          disabled={currentPage >= totalPages}
                          className={`p-1 rounded transition-colors ${
                            currentPage >= totalPages 
                              ? 'text-zinc-300 cursor-not-allowed' 
                              : 'text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          <ChevronsRightIcon className="h-4 w-4" />
                        </button>
                        <span className="text-sm text-zinc-600 ml-2">
                          {itemsPerPage}/{t("page")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
