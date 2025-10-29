import { useState, useEffect, useRef } from "react";
import {
  ChartContainer,
  ChartTooltip,
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
import type { ChartConfig } from "tentix-ui";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  ResponsiveContainer,
  Cell,
  Label,
  ReferenceLine,
} from "recharts";
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

const getChartConfig = (t: any) => ({
  accessCount: {
    label: t("access_count"),
  },
  hitRate: {
    label: t("hit_rate"),
  },
}) satisfies ChartConfig;

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
      offsetX: -2,
      offsetY: 65,
      textAlign: 'right' as const,
    },
    {
      key: 'low_efficiency',
      baseX: lowEffX,
      baseY: lowEffY,
      color: ZONE_COLORS.low_efficiency,
      title: t("low_efficiency_zone"),
      description: t("recommend_updating_content"),
      offsetX: -2,
      offsetY: -57,
      textAlign: 'right' as const,
    },
    {
      key: 'high_efficiency',
      baseX: highEffX,
      baseY: highEffY,
      color: ZONE_COLORS.high_efficiency,
      title: t("high_efficiency_zone"),
      description: t("maintain_and_promote_content"),
      offsetX: -11,
      offsetY: 65,
      textAlign: 'left' as const,
    },
    {
      key: 'need_optimization',
      baseX: needOptX,
      baseY: needOptY,
      color: ZONE_COLORS.need_optimization,
      title: t("needs_optimization"),
      description: t("recommend_improving_accuracy"),
      offsetX: -11,
      offsetY: -57,
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

  const chartConfig = getChartConfig(t);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && payload[0]?.payload) {
      const data = payload[0].payload as KnowledgeItem;
      return (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-4 min-w-[280px]">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 border-b pb-2">
              <div 
                className="w-2 h-2" 
                style={{ backgroundColor: ZONE_COLORS[data.zone] }}
              ></div>
              <div className="font-medium text-zinc-900">
                {data.title}
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 ">{t("access_count")}：</span>
                <span className="">{data.accessCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 ">{t("hit_rate")}：</span>
                <span className="">{data.hitRate}%</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <div className="bg-white border border-zinc-200 rounded-t-lg flex w-full h-16 p-6 justify-between items-center flex-shrink-0 shadow-sm">
        <h2 className="text-xl  text-zinc-900">{t("knowledge_base_hit_distribution")}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-8">
        <div className=" border-zinc-200 rounded-lg p-4">
          <div className="h-[500px] relative" ref={chartContainerRef}>
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 30, right: 20, bottom: 13, left: -30 }}>
                  <XAxis
                    type="number"
                    dataKey="accessCount"
                    name={t("access_count")}
                    stroke="#9CA3AF"
                    tick={{ fontSize: 12 }}
                    domain={[0, xAxisMax]}
                  >
                    <Label value={t("access_count")} position="insideBottom" offset={-10} />
                  </XAxis>
                  
                  <YAxis
                    type="number"
                    dataKey="hitRate"
                    name={`${t("hit_rate")}(%)`}
                    stroke="#9CA3AF"
                    tick={{ fontSize: 12 }}
                    domain={[0, yAxisMax]}
                  >
                    <Label value={`${t("hit_rate")}(%)`} position="top" offset={20} style={{ textAnchor: 'start' }} />
                  </YAxis>

                  <ZAxis 
                    type="number" 
                    dataKey="z" 
                    range={[100, 600]} 
                    name={t("access_count")}
                  />

                  <ReferenceLine 
                    y={hitRateThreshold} 
                    stroke="#CBD5E1" 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />

                  <ReferenceLine 
                    x={accessThreshold} 
                    stroke="#CBD5E1" 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />

                  <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                  
                  <Scatter 
                    name={t("questions")} 
                    data={classifiedData}
                    fill="#8884d8"
                  >
                    {classifiedData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={ZONE_COLORS[entry.zone as keyof typeof ZONE_COLORS]}
                        fillOpacity={0.7}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </ChartContainer>
            
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