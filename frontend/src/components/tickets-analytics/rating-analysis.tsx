import { ChartContainer, ChartTooltip } from "tentix-ui";
import type { ChartConfig } from "tentix-ui";
import { PieChart, Pie, Cell, ResponsiveContainer} from "recharts";
import { ratingAnalysisQueryOptions, useSuspenseQuery } from "@lib/query";
import { useTranslation } from "i18n";

// 定义评分图表配置 - 将在组件内部使用翻译
const getRatingChartConfig = (t: any) => ({
  "1星": {
    label: `1${t("star")}`,
    color: "#EF4444",
  },
  "2星": {
    label: `2${t("star")}`, 
    color: "#F97316",
  },
  "3星": {
    label: `3${t("star")}`,
    color: "#FCD34D",
  },
  "4星": {
    label: `4${t("star")}`,
    color: "#60A5FA",
  },
  "5星": {
    label: `5${t("star")}`,
    color: "#3B82F6",
  },
  "未评分": {
    label: t("unrated"),
    color: "#9CA3AF",
  },
}) satisfies ChartConfig;

const getHandoffChartConfig = (t: any) => ({
  handoff: {
    label: t("transferred_to_agent_tickets"),
    color: "#FCD34D",
  },
  nonHandoff: {
    label: t("not_transferred_to_agent_tickets"),
    color: "#3B82F6",
  },
}) satisfies ChartConfig;

interface RatingAnalysisProps {
  filterParams?: {
    startDate?: string;
    endDate?: string;
    agentId?: string;
    isToday?: boolean;
  };
  isLoading?: boolean;
}

export function RatingAnalysis({ 
  filterParams, 
  isLoading: externalLoading 
}: RatingAnalysisProps) {
  const { t } = useTranslation();

  const { data } = useSuspenseQuery(ratingAnalysisQueryOptions(filterParams));

  if (externalLoading || !data) {
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


  const totalRatings = data.ratingDistribution.reduce((sum, item) => sum + item.value, 0);

  const handoffData = [
    {
      name: t("transferred_to_agent_tickets"),
      value: data.handoffDistribution.handoffTickets,
      percentage: data.handoffDistribution.handoffRate,
      type: "handoff",
    },
    {
      name: t("not_transferred_to_agent_tickets"), 
      value: data.handoffDistribution.nonHandoffTickets,
      percentage: Number((100 - data.handoffDistribution.handoffRate).toFixed(2)),
      type: "nonHandoff",
    },
  ];

  const totalTickets = data.handoffDistribution.totalTickets;

  const ratingChartConfig = getRatingChartConfig(t);
  const handoffChartConfig = getHandoffChartConfig(t);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* 左侧：评分点比分布 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 标题 */}
        <div className="p-4 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            {t("rating_distribution_analysis")}
          </h2>
        </div>
        {/* 内容区域 */}
        <div className="p-6 pt-14">
          <div className="space-y-6 items-center">
            {/* 环形图和图例 */}
            <div className="flex items-center justify-center space-x-15">
              {/* 环形图 */}
              <div className="h-[200px] w-[200px]">
                <ChartContainer config={ratingChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.ratingDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={0}
                        dataKey="value"
                        nameKey="name"
                        labelLine={false}
                      >
                        {data.ratingDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={ratingChartConfig[entry.name as keyof typeof ratingChartConfig].color}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        cursor={false} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length && payload[0]?.payload) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3">
                                <div className="space-y-1">
                                  <div className="font-medium text-zinc-900">{data.name}</div>
                                  <div className="text-sm text-zinc-600">
                                    {t("count")}：<span className="font-semibold">{data.value}</span>
                                  </div>
                                  <div className="text-sm text-zinc-600">
                                    {t("percentage")}：<span className="font-semibold">{data.percentage}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* 环形图中心文本 */}
                      <text
                        x="50%"
                        y="45%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-3xl font-bold fill-zinc-900"
                      >
                        {totalRatings}
                      </text>
                      <text
                        x="50%"
                        y="55%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-sm fill-zinc-500"
                      >
                        {t("total_rating_count")}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              {/* 图例列表 */}
              <div className="space-y-1">
                {data.ratingDistribution.map((item, index) => (
                  <div key={index} className="flex items-center border-b border-zinc-200 pb-2">
                    <span className="flex items-center space-x-2 w-30 h-9">
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: ratingChartConfig[item.name as keyof typeof ratingChartConfig].color }}
                      ></span>
                      <span className="text-sm text-zinc-700">{item.name}</span>
                    </span>
                    <span className="flex items-center space-x-10 text-sm text-zinc-600">
                      <span className="w-20 text-left">{t("percentage")}{item.percentage}%</span>
                      <span className="w-12 text-left font-medium">{item.value}{t("times")}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：转人工情况分布 */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm">
        {/* 标题 */}
        <div className="p-4 border-b border-zinc-200">
          <h2 className="text-xl font-semibold text-zinc-900">
            {t("manual_transfer_distribution")}
          </h2>
        </div>

        {/* 内容区域 */}
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="space-y-6">
            {/* 环形图和图例 */}
            {totalTickets > 0 ? (
              <div className="flex items-center justify-center space-x-15">
                {/* 环形图 */}
                <div className="h-[200px] w-[200px]">
                  <ChartContainer config={handoffChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={handoffData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={0}
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                        >
                          {handoffData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={handoffChartConfig[entry.type as keyof typeof handoffChartConfig]?.color || '#E4E4E7'}
                            />
                          ))}
                        </Pie>
                        <ChartTooltip 
                          cursor={false} 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length && payload[0]?.payload) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3">
                                  <div className="space-y-1">
                                    <div className="font-medium text-zinc-900">{data.name}</div>
                                    <div className="text-sm text-zinc-600">
                                      {t("count")}：<span className="font-semibold">{data.value}</span>
                                    </div>
                                    <div className="text-sm text-zinc-600">
                                      {t("percentage")}：<span className="font-semibold">{data.percentage}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {/* 环形图中心文本 */}
                        <text
                          x="50%"
                          y="45%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-3xl font-bold fill-zinc-900"
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
                          {t("total_tickets")}
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>

                {/* 图例列表 */}
                <div className="space-y-1">
                  {handoffData.map((item, index) => (
                    <div key={index} className="flex items-center border-b border-zinc-200 pb-2">
                      <span className="flex items-center space-x-2 w-33 h-9">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: handoffChartConfig[item.type as keyof typeof handoffChartConfig]?.color || '#E4E4E7' }}
                        ></span>
                        <span className="text-sm text-zinc-700">{item.name}</span>
                      </span>
                      <span className="flex items-center space-x-15 text-sm text-zinc-600">
                        <span className="w-20 text-left">{t("percentage")}{item.percentage}%</span>
                        <span className="w-12 text-left font-medium">{item.value}{t("times")}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-500">
                {t("no_data")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}