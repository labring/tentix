import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { logError } from "../log.ts";

// 类型定义
interface HotIssueData {
  tag: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

interface TagData {
  tag: string;
  count: number;
  percentage: number;
}

const aiInsightsSchema = z.object({
  keyFindings: z.array(z.string()).min(1).max(10).describe("关键发现，4-10条"),
  improvements: z.array(z.string()).min(1).max(10).describe("改进建议，4-10条"),
  strategy: z.string().min(50).describe("整体策略，80-150字"),
});

export type AIInsightsResult = z.infer<typeof aiInsightsSchema>;

// 常量配置
const AI_INSIGHTS_TIMEOUT_MS = 20000;
const TREND_TEXT_MAP = {
  up: '上升',
  down: '下降',
  stable: '稳定',
} as const;
const SYSTEM_PROMPT = `你是 Sealos 工单系统的数据分析师。你的任务是分析工单数据并生成洞察报告。
输出要求：
1. keyFindings（关键发现）：4-10 条，基于趋势、优先级、占比分析数据特征，能量化尽量量化
2. improvements（改进建议）：4-10 条，与关键发现对应，给出具体可执行的改进措施
3. strategy（整体策略）：80-150 字，从预防-监控-响应-复盘闭环给出整体方向

分析原则：
- 充分利用趋势（上升/下降/稳定）、优先级（P0-P3）、占比等信息
- 改进建议要具体可落地（如建立SOP、优化监控、完善文档等）
- 策略要强调资源配置、流程优化、风险前置
- 避免重复表述，不臆造数据中不存在的信息`;

// 错误响应
const ERROR_RESPONSES = {
  noApiKey: {
    keyFindings: ["AI 服务未配置"],
    improvements: ["请配置 OpenAI API Key"],
    strategy: "AI 服务未配置，无法生成分析洞察",
  },
  noModel: {
    keyFindings: ["AI 模型未配置"],
    improvements: ["请配置分析模型"],
    strategy: "AI 服务未配置，无法生成分析洞察",
  },
  noData: {
    keyFindings: ["暂无工单数据"],
    improvements: ["等待数据积累"],
    strategy: "数据不足，无法生成有效的分析洞察",
  },
  timeout: {
    keyFindings: ["AI 分析响应超时"],
    improvements: ["请稍后重试或检查网络连接"],
    strategy: `分析请求超时（${AI_INSIGHTS_TIMEOUT_MS}ms），请稍后重试`,
  },
  unknown: (errorMsg: string) => ({
    keyFindings: ["AI 分析失败"],
    improvements: ["请检查配置或联系管理员"],
    strategy: `生成洞察时出错：${errorMsg.substring(0, 100)}`,
  }),
};

//超时控制
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

//验证配置
function validateConfig(): { valid: boolean; error?: AIInsightsResult } {
  if (!OPENAI_CONFIG.apiKey) {
    logError("OPENAI_API_KEY is not configured");
    return { valid: false, error: ERROR_RESPONSES.noApiKey };
  }
  if (!OPENAI_CONFIG.analysisModel) {
    logError("ANALYSIS_MODEL is not configured");
    return { valid: false, error: ERROR_RESPONSES.noModel };
  }
  return { valid: true };
}

//验证数据
function validateData(
  topIssues: HotIssueData[],
  totalIssues: number
): { valid: boolean; error?: AIInsightsResult } {
  if (totalIssues === 0 || topIssues.length === 0) {
    return { valid: false, error: ERROR_RESPONSES.noData };
  }
  return { valid: true };
}

/*构建用户消息内容*/
function buildUserMessage(
  topIssues: HotIssueData[],
  tagStats: TagData[],
  totalIssues: number
): string {
  const topIssuesList = topIssues
    .slice(0, 10)
    .map((issue, index) => {
      const trendText = TREND_TEXT_MAP[issue.trend];
      return `${index + 1}. ${issue.tag} - ${issue.count}次 (趋势:${trendText}, 优先级:${issue.priority})`;
    })
    .join('\n');

  const tagStatsList = tagStats
    .slice(0, 10)
    .map((tag) => `- ${tag.tag}: ${tag.count}次 (占比${tag.percentage.toFixed(1)}%)`)
    .join('\n');

  return `请分析以下工单数据：
## 数据概况
总问题数: ${totalIssues}
## TOP 问题列表
${topIssuesList}
## 标签统计
${tagStatsList}`;
}
//创建OpenAI客户端
function createOpenAIClient(): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.analysisModel,
    temperature: 0.3,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });
}
//验证AI返回结果
function validateAIResult(result: AIInsightsResult): void {
  if (!result.keyFindings?.length || !result.improvements?.length || !result.strategy) {
    throw new Error("AI 返回结果不完整");
  }
}

function handleError(error: unknown): AIInsightsResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logError("generateAIInsights error", error);
  if (errorMessage.includes("AI_INSIGHTS_TIMEOUT")) {
    logError(`AI insights generation timed out after ${AI_INSIGHTS_TIMEOUT_MS}ms`);
    return ERROR_RESPONSES.timeout;
  }
  return ERROR_RESPONSES.unknown(errorMessage);
}

/**生成 AI 洞察报告*/
export async function generateAIInsights(
  topIssues: HotIssueData[],
  tagStats: TagData[],
  totalIssues: number
): Promise<AIInsightsResult> {
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    return configValidation.error!;
  }

  const dataValidation = validateData(topIssues, totalIssues);
  if (!dataValidation.valid) {
    return dataValidation.error!;
  }

  try {
    const model = createOpenAIClient();
    const structuredModel = model.withStructuredOutput(aiInsightsSchema, {
      strict: true,
    });
    const userMessage = buildUserMessage(topIssues, tagStats, totalIssues);
    const result = await withTimeout(
      structuredModel.invoke([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ]),
      AI_INSIGHTS_TIMEOUT_MS,
      "AI_INSIGHTS_TIMEOUT"
    );
    validateAIResult(result);
    return result;
  } catch (error) {
    // 8️⃣ 错误处理
    return handleError(error);
  }
}