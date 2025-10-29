import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { logError } from "../log.ts";

interface HotIssueData {
  category: string;
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

// AI洞察结果的结构化输出定义
const aiInsightsSchema = z.object({
  keyFindings: z.array(z.string()).max(10).default([]),
  improvements: z.array(z.string()).max(10).default([]),
  strategy: z.string().default(""),
});

export type AIInsightsResult = z.infer<typeof aiInsightsSchema>;

export async function generateAIInsights(
  topIssues: HotIssueData[],
  categoryStats: CategoryData[],
  totalIssues: number
): Promise<AIInsightsResult> {
  try {
    const model = new ChatOpenAI({
      apiKey: OPENAI_CONFIG.apiKey,
      model: OPENAI_CONFIG.summaryModel,
      temperature: 0.3,
      configuration: {
        baseURL: OPENAI_CONFIG.baseURL,
      },
    });

    const prompt = `你是 Sealos 工单系统的数据分析师，**只分析**工单数据并生成洞察报告。**只输出 JSON**。

## 输出协议（严格）
- 只输出不带 Markdown 的 JSON 字符串，可被 JSON.parse 成功解析。
- 结构与字段：
  {
    "keyFindings": string[],   // 恰好 4 条，每条 ≤100 字
    "improvements": string[],  // 恰好 4 条，每条 ≤100 字
    "strategy": string         // 80-150 字，面向全局的策略建议
  }
- 不要输出额外字段；不要包含注释或解释文本；不得输出自然语言段落。

## 判定要点
- keyFindings：基于趋势（上升/下降/稳定）、优先级（P0-P3）、占比/贡献度、波动性与影响面；能量化尽量量化；避免重复表述。
- improvements：与 keyFindings 一一对应，具体可执行（流程/产品/技术/运营），可落地（如建立 SOP/扩容/优化监控/修复缺陷/完善文档）。
- strategy：从预防-监控-响应-复盘闭环给出方向；强调资源配置、流程优化、风险前置；避免与 improvements 重复。
- 若样本量不足或波动大，需提示不确定性（但仍按输出协议给出完整 JSON）。

## 结合上下文
- 充分利用以下输入：
  - 总问题数 totalIssues
  - TOP 问题（category/tag/count/trend/priority）
  - 分类统计（category/count/percentage）
- 洞察来自数据本身，不得臆造不存在的维度或结论；引用趋势/优先级/占比时需与输入一致。

## 数据概况
总问题数: ${totalIssues}

## TOP问题列表
${topIssues.slice(0, 5).map((issue, index) => 
  `${index + 1}. [${issue.category}] ${issue.tag} - ${issue.count}次 (${issue.trend === 'up' ? '上升' : issue.trend === 'down' ? '下降' : '稳定'}, ${issue.priority})`
).join('\n')}

## 分类统计
${categoryStats.slice(0, 5).map((cat) => 
  `- ${cat.category}: ${cat.count}次 (${cat.percentage}%)`
).join('\n')}

## 示例1（仅示意）
输入（节选）：
totalIssues: 120
TOP问题：
1. [技术问题] 登录失败 - 28 次 (上升, P1)
2. [支付问题] 退款异常 - 15 次 (稳定, P2)
分类统计（节选）：
- 技术问题: 55 次 (45.8%)
- 支付问题: 22 次 (18.3%)

输出：
{"keyFindings":["登录失败为最高频技术问题且上升，需优先关注","技术问题占比接近一半，影响范围广","支付相关问题稳定存在，需优化流程与兜底","高优先级问题集中于登录与鉴权链路"],"improvements":["为登录问题建立快速诊断与回滚SOP","完善鉴权与风控链路监控与告警","梳理支付异常路径并补齐兜底提示","对高频问题建立知识库与自助化脚本"],"strategy":"以技术稳定性为抓手，围绕登录与鉴权链路做预防性加固，配套监控告警与应急演练；并行优化支付流程体验，完善异常兜底与用户提示；建立高频问题知识库与自动化工具，提升处理效率并降低重复工单。"}

只输出 { "keyFindings": [...], "improvements": [...], "strategy": "..." } 的 JSON。`;

    const out = await model
      .withStructuredOutput(aiInsightsSchema)
      .invoke(prompt);

    return {
      keyFindings: out.keyFindings || [],
      improvements: out.improvements || [],
      strategy: out.strategy || "",
    };
  } catch (error) {
    logError("generateAIInsights", error);
    // 失败时返回默认值，避免中断流程
    return {
      keyFindings: [],
      improvements: [],
      strategy: "数据不足，无法生成分析洞察",
    };
  }
}