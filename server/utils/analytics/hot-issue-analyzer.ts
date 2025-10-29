import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import * as relations from "@db/relations.ts";
import type { JSONContentZod } from "../types.ts";
import { extractText } from "../types.ts";
import { eq, sql, count, avg, gte, lte, desc, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { convertToMultimodalMessage } from "../kb/tools.ts";

type AppSchema = typeof schema & typeof relations;

async function getExistingCategoriesAndTags(db: NodePgDatabase<AppSchema>) {
  const categories = await db
    .select({
      category: schema.hotIssues.issueCategory,
      count: count(),
    })
    .from(schema.hotIssues)
    .groupBy(schema.hotIssues.issueCategory)
    .orderBy(desc(count()))
    .limit(20);

  const tags = await db
    .select({
      tag: schema.hotIssues.issueTag,
      count: count(),
    })
    .from(schema.hotIssues)
    .groupBy(schema.hotIssues.issueTag)
    .orderBy(desc(count()))
    .limit(30);

  return {
    categories: categories.map((c) => c.category),
    tags: tags.map((t) => t.tag),
  };
}

// 热问题分析结果的 Zod schema
const hotIssueAnalysisSchema = z.object({
  category: z.string().describe("问题分类，优先使用现有分类"),
  tag: z.string().describe("具体问题标签，描述问题细节"),
  confidence: z.number().min(0).max(1).describe("置信度，0-1之间"),
  reasoning: z.string().optional().describe("简要推理依据，≤50字"),
});

type AIAnalysisResult = z.infer<typeof hotIssueAnalysisSchema>;

async function analyzeWithAI(
  title: string,
  description: JSONContentZod,
  existingCategories: string[],
  existingTags: string[]
): Promise<AIAnalysisResult> {
  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.summaryModel,
    temperature: 0.3,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });

  // 使用多模态消息转换
  const multimodalContent = convertToMultimodalMessage(description);
  const descriptionText = extractText(description);

  const promptText = `你是 Sealos 工单系统的分类助手，**只分析**工单内容并生成分类标签。

## 判定要点
- 优先复用"现有分类/标签"（提供于上下文）；相似度 ≥70% 时应归入现有项。
- 分类需简洁稳健（如：技术问题/账户问题/支付问题/性能问题/界面问题/服务问题/系统问题/部署问题/网络问题/存储问题）。
- 标签必须具体到现象/对象/操作（如："镜像拉取失败""证书过期""Readiness probe failed"）。
- 出现明确错误码/错误片段（如 5xx/ImagePullBackOff/x509/ECONNREFUSED）应体现在标签中。
- 出现组件/模块名（如 devbox/applaunchpad/ingress/pvc）应纳入标签语义。
- 存在歧义/信息不足时：降低 confidence（≤0.6），reasoning 标注"信息不足/语义含糊"。

## 结合上下文
- 综合"标题/富文本描述（提取纯文本）/图片内容（若有）"与"现有分类/标签列表"进行判定。
- 若包含图片，请结合图片中的错误信息、界面元素、配置截图辅助分类与打标签。
- 严禁臆造不存在的字段或信息；无法确定时宁可降低 confidence。

## 工单内容
标题: "${title}"
描述(纯文本): "${descriptionText}"

## 现有分类标签
分类: ${existingCategories.length > 0 ? existingCategories.join(", ") : "暂无"}
标签: ${existingTags.length > 0 ? existingTags.join(", ") : "暂无"}

## 示例1（仅示意）
输入：
标题: "applaunchpad 部署失败 ImagePullBackOff"
描述(纯文本): "新版本发布后，应用一直 Pending，事件提示镜像拉取失败，私有仓库凭证已配置。"
现有分类: ["部署问题","镜像问题","网络问题"]
现有标签: ["镜像拉取失败","凭证错误","私有仓库权限"]

输出：
{"category":"镜像问题","tag":"镜像拉取失败","confidence":0.86,"reasoning":"事件包含 ImagePullBackOff，符合镜像拉取失败"}`;

  try {
    const structuredModel = model.withStructuredOutput(hotIssueAnalysisSchema);
    
    let result: AIAnalysisResult;
    
    if (typeof multimodalContent === 'string') {
      // 纯文本消息
      result = await structuredModel.invoke(promptText);
    } else {
      // 多模态消息（包含图片）
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: promptText },
            ...multimodalContent.filter(item => item.type === "image_url")
          ]
        }
      ];
      result = await structuredModel.invoke(messages);
    }
    
    return {
      category: result.category || "未分类",
      tag: result.tag || "其他问题",
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("AI分类分析失败:", error);
    throw error;
  }
}

export async function analyzeAndSaveHotIssue(
  db: NodePgDatabase<AppSchema>,
  ticketId: string,
  title: string,
  description: JSONContentZod
): Promise<void> {
  try {
    const { categories, tags } = await getExistingCategoriesAndTags(db);
    
    const analysis = await analyzeWithAI(
      title,
      description,
      categories,
      tags
    );
    
    await db.insert(schema.hotIssues).values({
      ticketId,
      issueCategory: analysis.category,
      issueTag: analysis.tag,
      confidence: analysis.confidence,
      isAiGenerated: true,
    });
  } catch (error) {
    throw error;
  }
}

export async function getHotIssuesStats(
  db: NodePgDatabase<AppSchema>,
  timeRange: { start: Date; end: Date }
) {
  const categoryStats = await db
    .select({
      category: schema.hotIssues.issueCategory,
      count: count(),
      avgConfidence: avg(schema.hotIssues.confidence),
    })
    .from(schema.hotIssues)
    .where(
      and(
        gte(schema.hotIssues.createdAt, timeRange.start.toISOString()),
        lte(schema.hotIssues.createdAt, timeRange.end.toISOString())
      )
    )
    .groupBy(schema.hotIssues.issueCategory)
    .orderBy(desc(count()));

  const tagStats = await db
    .select({
      category: schema.hotIssues.issueCategory,
      tag: schema.hotIssues.issueTag,
      count: count(),
      avgConfidence: avg(schema.hotIssues.confidence),
    })
    .from(schema.hotIssues)
    .where(
      and(
        gte(schema.hotIssues.createdAt, timeRange.start.toISOString()),
        lte(schema.hotIssues.createdAt, timeRange.end.toISOString())
      )
    )
    .groupBy(schema.hotIssues.issueCategory, schema.hotIssues.issueTag)
    .orderBy(desc(count()))
    .limit(10);

  return {
    categoryStats,
    tagStats,
  };
}

