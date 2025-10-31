import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import { type JSONContentZod } from "../types.ts";
import { eq, sql, count, desc, and } from "drizzle-orm";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { convertToMultimodalMessage, extractTextWithoutImages } from "../kb/tools.ts";
import type { MMItem } from "../kb/workflow-node/workflow-tools.ts";
import { connectDB } from "../tools.ts";

type DB = ReturnType<typeof connectDB>;

async function getExistingTags(db: DB) {
  const tagResults = await db
    .select({
      tagId: schema.tags.id,
      name: schema.tags.name,
      description: schema.tags.description,
      usageCount: count(schema.ticketsTags.id),
    })
    .from(schema.tags)
    .leftJoin(schema.ticketsTags, eq(schema.tags.id, schema.ticketsTags.tagId))
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.description)
    .orderBy(desc(count(schema.ticketsTags.id)))
    .limit(50);

  return tagResults.map((t) => ({
    name: t.name,
    description: t.description,
    usageCount: Number(t.usageCount),
  }));
}

const hotIssueAnalysisSchema = z.object({
  name: z.string().describe("问题标签名称，简洁明了，如：技术问题、支付问题、性能问题"),
  description: z.string().max(6).describe("问题标签的简要描述，最多6个字，总结关键信息，如：应用部署出现问题"),
  confidence: z.number().min(0).max(1).describe("置信度，0-1之间"),
  reasoning: z.string().nullable().optional().describe("简要推理依据，≤50字"),
});

type AIAnalysisResult = z.infer<typeof hotIssueAnalysisSchema>;

/**
 * 使用 AI 分析工单内容，返回标签
 */
async function analyzeWithAI(
  title: string,
  description: JSONContentZod,
  existingTags: Array<{ name: string; description: string; usageCount: number }>
): Promise<AIAnalysisResult> {
  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.analysisModel,
    temperature: 0.3,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });

  // 使用文本转换为多模态消息
  const multimodalContent = convertToMultimodalMessage(description);
  const tagsText = existingTags.length > 0
    ? existingTags
        .map((t) => `- ${t.name}: ${t.description} (使用次数: ${t.usageCount})`)
        .join("\n")
    : "暂无现有标签";

  // System prompt: 包含角色说明、规则、现有标签、示例
  const systemPrompt = `你是 Sealos 工单系统的标签分析助手，**只分析**工单内容并生成问题标签。

## 判定要点
- **优先复用现有标签**（见下方列表），相似度 ≥70% 时应归入现有项。
- **标签名称**需简洁明了，代表问题类别（如：技术问题、支付问题、性能问题、界面问题等）。
- **标签描述**必须控制在6个字以内，总结关键问题信息（例如：应用部署出现问题、用户无法登录、支付流程中断、页面加载缓慢等）。
  - 优先包含：错误类型/现象、组件/模块名、关键操作
  - 避免冗余词汇，直接表达核心问题
- 出现明确错误码/错误片段（如 5xx/ImagePullBackOff/x509/ECONNREFUSED）应体现在描述中。
- 出现组件/模块名（如 devbox/applaunchpad/ingress/pvc）应纳入描述语义。
- 存在歧义/信息不足时：降低 confidence（≤0.6），reasoning 标注"信息不足/语义含糊"。

## 结合上下文
- 综合"标题/描述内容/图片内容（若有）"与"现有标签列表"进行判定。
- 若包含图片，请结合图片中的错误信息、界面元素、配置截图辅助分析。
- 严禁臆造不存在的字段或信息；无法确定时宁可降低 confidence。

## 现有标签列表（按使用频率排序）
${tagsText}

## 示例1（使用现有标签）
输入：
标题: "applaunchpad 部署失败 ImagePullBackOff"
描述(纯文本): "新版本发布后，应用一直 Pending，事件提示镜像拉取失败，私有仓库凭证已配置。"
现有标签: ["部署问题: 应用部署出现问题", "技术问题: 系统技术故障"]

输出：
{
  "name": "部署问题",
  "description": "应用部署出现问题",
  "confidence": 0.86,
  "reasoning": "ImagePullBackOff 是典型的部署问题"
}

## 示例2（创建新标签）
输入：
标题: "支付页面无法加载"
描述(纯文本): "用户点击支付按钮后，支付页面一直显示加载中，无法完成支付。"
现有标签: ["技术问题: 系统技术故障", "界面问题: 界面交互异常"]

输出：
{
  "name": "支付问题",
  "description": "支付流程中断",
  "confidence": 0.82,
  "reasoning": "支付相关的特定问题类型"
}`;

  // 实际内容
  const userPromptText = `标题: ${title}

描述: ${typeof multimodalContent === "string" ? multimodalContent : extractTextWithoutImages(description)}`;

  // 构建 user 消息（可能包含图片）
  let userContent: string | MMItem[];
  if (typeof multimodalContent === "string") {
    // 纯文本
    userContent = userPromptText;
  } else {
    // 多模态（文本 + 图片）
    const images = multimodalContent.filter((item): item is { type: "image_url"; image_url: { url: string } } => 
      item.type === "image_url"
    );
    userContent = [
      { type: "text", text: userPromptText },
      ...images
    ];
  }

  // 创建结构化输出模型并调用
  const structuredModel = model.withStructuredOutput(hotIssueAnalysisSchema);
  const result: AIAnalysisResult = await structuredModel.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]);

  return {
    name: result.name || "其他问题",
    description: result.description || "未明确分类的问题",
    confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
    reasoning: result.reasoning,
  };
}

/**
 * 在 tags 表中查找或创建标签
 */
async function findOrCreateTag(
  db: DB,
  name: string,
  description: string
): Promise<number> {
  // 先查找是否存在相同名称的标签
  const existing = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.name, name))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    return existing[0].id;
  }

  // 不存在则创建新标签
  const result = await db
    .insert(schema.tags)
    .values({
      name,
      description,
      isAiGenerated: true,
    })
    .returning({ id: schema.tags.id });

  if (!result[0]) {
    throw new Error("Failed to create tag");
  }

  return result[0].id;
}


export async function analyzeAndSaveHotIssue(
  db: DB,
  ticketId: string,
  title: string,
  description: JSONContentZod
): Promise<void> {
  // 检查 OPENAI 配置
  if (!OPENAI_CONFIG.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!OPENAI_CONFIG.summaryModel) {
    throw new Error("SUMMARY_MODEL is not configured");
  }

  // 获取现有的标签
  const existingTags = await getExistingTags(db);

  // AI 分析
  const analysis = await analyzeWithAI(title, description, existingTags);

  // 查找或创建标签
  const tagId = await findOrCreateTag(
    db,
    analysis.name,
    analysis.description
  );

  // 检查是否已经关联过这个标签（避免重复）
  const existingLink = await db
    .select()
    .from(schema.ticketsTags)
    .where(
      and(
        eq(schema.ticketsTags.ticketId, ticketId),
        eq(schema.ticketsTags.tagId, tagId)
      )
    )
    .limit(1);

  // 创建工单-标签关联（如果不存在）
  if (existingLink.length === 0) {
    await db.insert(schema.ticketsTags).values({
      ticketId,
      tagId,
      confidence: analysis.confidence,
      isAiGenerated: true,
    });
  }
}

export async function getHotIssuesStats(
  db: DB,
  timeRange: { start: Date; end: Date }
) {
  // 标签统计
  const tagStats = await db
    .select({
      tag: schema.tags.name,
      tagDescription: schema.tags.description,
      count: count(schema.ticketsTags.id),
      avgConfidence: sql<number>`avg(${schema.ticketsTags.confidence})`,
    })
    .from(schema.tags)
    .innerJoin(schema.ticketsTags, eq(schema.tags.id, schema.ticketsTags.tagId))
    .where(
      and(
        sql`${schema.ticketsTags.createdAt} >= ${timeRange.start.toISOString()}`,
        sql`${schema.ticketsTags.createdAt} <= ${timeRange.end.toISOString()}`
      )
    )
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.description)
    .orderBy(desc(count(schema.ticketsTags.id)));

  return {
    tagStats,
  };
}
