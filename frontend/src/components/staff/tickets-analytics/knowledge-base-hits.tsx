import { useState } from "react";
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

// 定义区域颜色
const ZONE_COLORS = {
  high_efficiency: "#10B981", 
  potential: "#3B82F6", 
  need_optimization: "#FCD34D", 
  low_efficiency: "#9CA3AF", 
};

// 定义图表配置 - 将在组件内部使用翻译
const getChartConfig = (t: any) => ({
  accessCount: {
    label: t("access_count"),
  },
  hitRate: {
    label: t("hit_rate"),
  },
}) satisfies ChartConfig;

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
  const itemsPerPage = 6; // 每页显示6条数据

  // 使用 TanStack Query 获取数据
  const { data } = useSuspenseQuery(knowledgeHitsQueryOptions(filterParams));

  const loading = externalLoading;

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

  // 准备气泡图数据（气泡大小由访问数决定）
  const scatterData = data.bubbleData || [];
  
  // 获取划分阈值（用于显示参考线）
  const avgAccessCount = data.metrics?.avgAccessCount || 0;
  const hitRateThreshold = data.metrics?.hitRateThreshold || 50;
  
  // 计算Y轴的合适范围（考虑命中率可能超过100%）
  const maxHitRate = Math.max(...scatterData.map(d => d.hitRate), 100);
  const yAxisMax = Math.ceil(maxHitRate / 10) * 10; // 向上取整到10的倍数
  
  // 计算X轴的范围
  const maxAccessCount = Math.max(...scatterData.map(d => d.accessCount), 100);
  const xAxisMax = Math.ceil(maxAccessCount / 10) * 10;
  
  // 准备气泡数据，添加 z 值用于控制气泡大小
  const bubbleData = scatterData.map(item => ({
    ...item,
    z: item.accessCount, // 使用访问数作为气泡大小
  }));

  // 根据选中的区域筛选表格数据
  const getTableData = () => {
    if (selectedZone === "all") {
      return data.bubbleData || [];
    }
    return data.zoneGroups?.[selectedZone as keyof typeof data.zoneGroups] || [];
  };

  const allTableData = getTableData();
  
  // 计算分页
  const totalPages = Math.ceil(allTableData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const tableData = allTableData.slice(startIndex, endIndex);
  
  // 切换区域时重置页码
  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setCurrentPage(1);
  };
  
  // 翻页函数
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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
                <span className="text-zinc-600 font-semibold">{t("access_count")}：</span>
                <span className="font-semibold">{data.accessCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 font-semibold">{t("hit_rate")}：</span>
                <span className="font-semibold">{data.hitRate}%</span>
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
      {/* 标题 */}
      <div className="bg-white border border-zinc-200 rounded-t-lg p-4 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">{t("knowledge_base_hit_distribution")}</h2>
      </div>

      {/* 主体内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-6">
        {/* 左侧：气泡图 */}
        <div className=" border-zinc-200 rounded-lg p-4">

          {/* 散点图 */}
          <div className="h-[500px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 30, right: 20, bottom: 13, left: 0 }}>
                  
                  {/* X轴 - 访问数 */}
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
                  
                  {/* Y轴 - 命中率 */}
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

                  {/* Z轴 - 控制气泡大小（访问数越大，气泡越大） */}
                  <ZAxis 
                    type="number" 
                    dataKey="z" 
                    range={[100, 600]} 
                    name={t("access_count")}
                  />

                  {/* 参考线 - 命中率50%（横线） */}
                  <ReferenceLine 
                    y={hitRateThreshold} 
                    stroke="#CBD5E1" 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />

                  {/* 参考线 - 访问数平均值（竖线） */}
                  <ReferenceLine 
                    x={avgAccessCount} 
                    stroke="#CBD5E1" 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />

                  {/* 区域标签 - 暂时注释所有区域文本，保持图表简洁 */}
                  
                  {/* 潜力区 - 左下角区域（低访问数 + 高命中率） */}
                  {/* <text 
                    x={avgAccessCount * 0.3} 
                    y={hitRateThreshold * 4.8} 
                    textAnchor="start" 
                    fill="#000000" 
                    fontSize="13"
                    fontWeight="600"
                    opacity="0.75"
                  >
                    潜力区
                  </text>
                  <text 
                    x={avgAccessCount * 0.3} 
                    y={hitRateThreshold * 5.1} 
                    textAnchor="start" 
                    fill="#666666" 
                    fontSize="10"
                    opacity="0.65"
                  >
                    建议增加相关引导和推荐
                  </text> */}
                  
                  {/* 高效区 - 右上角区域（高访问数 + 高命中率） */}
                  {/* <text 
                    x={avgAccessCount * 0.79} 
                    y={hitRateThreshold * 5.2} 
                    textAnchor="middle" 
                    fill="#000000" 
                    fontSize="13"
                    fontWeight="600"
                    opacity="0.75"
                  >
                    高效区
                  </text>
                  <text 
                    x={avgAccessCount * 0.92} 
                    y={hitRateThreshold * 5.5} 
                    textAnchor="middle" 
                    fill="#666666" 
                    fontSize="10"
                    opacity="0.65"
                  >
                    保持并推广该部分内容
                  </text> */}
                  
                  {/* 低效区 - 左上角区域（低访问数 + 低命中率） */}
                  {/* <text 
                    x={avgAccessCount * 0.6} 
                    y={hitRateThreshold * 6.2} 
                    textAnchor="middle" 
                    fill="#000000" 
                    fontSize="13"
                    fontWeight="600"
                    opacity="0.75"
                  >
                    低效区
                  </text>
                  <text 
                    x={avgAccessCount * 0.5} 
                    y={hitRateThreshold * 5.8} 
                    textAnchor="middle" 
                    fill="#666666" 
                    fontSize="10"
                    opacity="0.65"
                  >
                    建议更新或移除内容
                  </text> */}
                  
                  {/* 需优化区 - 右下角区域（高访问数 + 低命中率） */}
                  {/* <text 
                    x={avgAccessCount * 0.79} 
                    y={hitRateThreshold * 6.2} 
                    textAnchor="middle" 
                    fill="#000000" 
                    fontSize="13"
                    fontWeight="600"
                    opacity="0.75"
                  >
                    需优化
                  </text>
                  <text 
                    x={avgAccessCount * 0.91} 
                    y={hitRateThreshold * 5.8} 
                    textAnchor="middle" 
                    fill="#666666" 
                    fontSize="10"
                    opacity="0.65"
                  >
                    建议提高内容准确性
                  </text> */}

                  <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                  
                  <Scatter 
                    name={t("questions")} 
                    data={bubbleData}
                    fill="#8884d8"
                  >
                    {bubbleData.map((entry, index) => (
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
          </div>
        </div>

        {/* 右侧：数据表格 */}
        <div className=" border-zinc-200 rounded-lg p-4">

          {/* 选项卡 */}
          <Tabs value={selectedZone} onValueChange={handleZoneChange} defaultValue="all">
            <TabsList className="grid w-full grid-cols-4 bg-white rounded-lg p-1 gap-1">
              <TabsTrigger 
                value="high_efficiency" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 last:border-r-0 flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-green-500"></div>
                {t("high_efficiency_zone")}
              </TabsTrigger>
              <TabsTrigger 
                value="potential" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 last:border-r-0 flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-blue-500"></div>
                {t("potential_zone")}
              </TabsTrigger>
              <TabsTrigger 
                value="need_optimization" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 last:border-r-0 flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-yellow-500"></div>
                {t("needs_optimization")}
              </TabsTrigger>
              <TabsTrigger 
                value="low_efficiency" 
                className="data-[state=active]:bg-zinc-100 hover:bg-zinc-50 border border-zinc-200 last:border-r-0 flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-gray-500"></div>
                {t("low_efficiency_zone")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedZone} className="mt-4">
               <div className="border rounded-lg">
                <div className="overflow-hidden min-h-[360px]">
                  <Table>
                    <TableHeader className="bg-white border-b border-zinc-200">
                      <TableRow>
                        <TableHead className="font-semibold">{t("questions")}</TableHead>
                        <TableHead className="text-right font-semibold">{t("access_count")}</TableHead>
                        <TableHead className="text-right font-semibold">{t("hit_rate")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.length > 0 ? (
                        <>
                          {tableData.map((item) => (
                            <TableRow key={item.id} className="border-b border-zinc-200">
                              <TableCell className="max-w-[200px] truncate h-[60px]" title={item.title}>
                                {item.title}
                              </TableCell>
                              <TableCell className="text-right h-[60px]">{item.accessCount}</TableCell>
                              <TableCell className="text-right h-[60px]">{item.hitRate}%</TableCell>
                            </TableRow>
                          ))}
                          {/* 填充空行以保持表格高度固定 */}
                          {Array.from({ length: itemsPerPage - tableData.length }).map((_, index) => (
                            <TableRow key={`empty-${index}`} className="border-b border-zinc-200">
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
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
                          {/* 填充空行 */}
                          {Array.from({ length: itemsPerPage - 1 }).map((_, index) => (
                            <TableRow key={`empty-${index}`} className="border-b border-zinc-200">
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
                              <TableCell className="h-[60px]">&nbsp;</TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页控件 */}
                {allTableData.length > 0 && (
                  <div className="border-t border-zinc-200 pt-4 px-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-500">
                        {t("total")}：{allTableData.length}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={goToPrevPage}
                          disabled={currentPage === 1}
                          className={`px-3 py-1 border rounded text-sm transition-colors ${
                            currentPage === 1 
                              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                              : 'bg-white text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          {t("previous_page")}
                        </button>
                        <span className="px-3 py-1 text-sm text-zinc-600">
                          {currentPage} / {totalPages || 1}
                        </span>
                        <button 
                          onClick={goToNextPage}
                          disabled={currentPage >= totalPages}
                          className={`px-3 py-1 border rounded text-sm transition-colors ${
                            currentPage >= totalPages 
                              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                              : 'bg-white text-zinc-700 hover:bg-zinc-50'
                          }`}
                        >
                          {t("next_page")}
                        </button>
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