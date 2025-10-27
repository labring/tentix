import { ChartContainer, ChartTooltip, ChartTooltipContent, Alert, AlertDescription, AlertTitle } from "tentix-ui";
import type { ChartConfig } from "tentix-ui";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Flame, TriangleAlert } from "lucide-react";
import { PendingIcon, ProgressIcon, DoneIcon } from "tentix-ui";
import { analyticsOverviewQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";
const getChartConfig = (t: any) => ({
  pending: {
    label: t("pending"),
    color: "#E4E4E7",
  },
  in_progress: {
    label: t("in_progress"), 
    color: "#FACC15",
  },
  resolved: {
    label: t("resolved"),
    color: "#2563EB",
  },
}) satisfies ChartConfig;

interface TicketStatusAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

export function TicketStatusAnalysis({ filterParams, isLoading: externalLoading }: TicketStatusAnalysisProps) {
  const { t } = useTranslation();
  
  const { data } = useSuspenseQuery(analyticsOverviewQueryOptions(filterParams));

  if (externalLoading || !data) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-zinc-200 rounded"></div>
            <div className="h-64 bg-zinc-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const ticketData = [
    { name: "pending", value: data.statusCounts.pending },
    { name: "in_progress", value: data.statusCounts.in_progress },
    { name: "resolved", value: data.statusCounts.resolved },
  ];

  const totalTickets = ticketData.reduce((sum, item) => sum + item.value, 0);
  const chartConfig = getChartConfig(t);

  // 关键指标数据
  const keyMetrics = [
    {
      title: t("backlog_rate"),
      value: `${data.backlogRate}%`,
      icon: Flame,
      color: "text-red-500",
    },
    {
      title: t("pending_tickets"),
      value: data.statusCounts.pending.toString(),
      icon: PendingIcon,
      color: "text-blue-600",
    },
    {
      title: t("in_progress_tickets"),
      value: data.statusCounts.in_progress.toString(),
      icon: ProgressIcon,
      color: "text-yellow-500",
    },
    {
      title: t("completion_rate"),
      value: `${data.completionRate}%`,
      icon: DoneIcon,
      color: "text-green-500",
    },
  ];

  return (
    <div className="w-full max-w-none min-w-0 px-0 mx-0">
      {/* 标题 */}
      <div className="mb-0">
        <div className="bg-white border border-zinc-200 rounded-t-lg p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            {t("ticket_status_analysis")}
          </h2>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white border-l border-r border-b border-zinc-200 rounded-b-lg p-6">
        {/* 左侧：环形图和图例 */}
        <div className="col-span-1 lg:col-span-1">
          <div className="p-6">
              {/* 环形图 - 更紧凑的布局 */}
              <div className="flex flex-col items-center">
                <div className="h-[160px] w-[160px] mb-4">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ticketData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={0}
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                        >
                          {ticketData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={chartConfig[entry.name as keyof typeof chartConfig].color}
                            />
                          ))}
                        </Pie>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        {/* 环形图中心的文本：总工单数 */}
                        <text
                          x="50%"
                          y="45%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-2xl font-bold fill-zinc-900"
                        >
                          {totalTickets}
                        </text>
                        <text
                          x="50%"
                          y="55%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-sm fill-zinc-500"
                        >
                          {t("total")} {t("tkt_other")}
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                
                {/* 图例表格 - 紧贴在环形图下方 */}
                <div className="w-full">
                  <table className="w-full text-sm -ml-7">
                    <tbody>
                      {ticketData.map((item, index) => (
                        <tr key={index} className="border-b border-zinc-100">
                          <td className="text-center py-2 px-2 w-2/5">
                            <div className="flex items-center justify-center space-x-2">
                              <span
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: chartConfig[item.name as keyof typeof chartConfig].color }}
                              ></span>
                              <span className="text-zinc-700">
                                {chartConfig[item.name as keyof typeof chartConfig].label}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-1 text-zinc-600 w-1/5">
                            {t("percentage")}
                          </td>
                          <td className="text-left py-2 px-1 text-zinc-600 font-medium w-1/5">
                            {totalTickets > 0 ? ((item.value / totalTickets) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td className="text-right py-2 px-1 text-zinc-600 font-medium w-1/5 -ml-4">
                            {item.value}
                          </td>
                          <td className="text-left py-2 px-1 text-zinc-600 font-medium w-1/5 -ml-4">
                            {t("times")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        </div>

        {/* 右侧：关键指标和建议 */}
        <div className="col-span-1 lg:col-span-2 flex flex-col space-y-6">
          {/* 关键指标卡片 */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-zinc-900">{t("key_metrics")}</h3>
            </div>
            <div>
              {/* 关键指标平行排列 */}
              <div className="grid grid-cols-4 border border-zinc-200 rounded-lg overflow-hidden">
                {keyMetrics.map((metric, index) => (
                  <div key={index} className="flex items-center space-x-3 p-4 relative">
                    {/* 添加分割线 */}
                    {index < 3 && (
                      <div className="absolute right-0 top-0 bottom-0 w-0.5 border-l border-dashed border-zinc-200"></div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <metric.icon className={`h-5 w-5 ${metric.color} flex-shrink-0`} />
                        <span className="text-xs text-zinc-500">{metric.title}</span>
                      </div>
                      <p className="text-2xl font-bold text-zinc-900 leading-tight tracking-wider">{metric.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 建议警告框 - 在关键指标正下方 */}
          {data.backlogWarning && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3">{t("suggestions")}</h3>
              <Alert variant="destructive" className="border-1 border-dashed border-black p-4 bg-gray-50">
                
                 <AlertTitle className="text-black flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-red-600" />{t("tkt")} {t("backlog_rate")} {t("error")}</AlertTitle>
                <AlertDescription className="text-black">
                  {t("current")} {t("pending")} {t("tkt")} {t("percentage")}<span className="text-red-600 font-semibold">{data.backlogRate}%</span>,{t("exceed_normal_level")},{t("suggestions")} {t("increase_manpower")}。
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}