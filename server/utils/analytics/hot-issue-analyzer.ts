import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as schema from "@db/schema.ts";
import { type JSONContentZod } from "../types.ts";
import { eq, sql, count, desc, and } from "drizzle-orm";
import { OPENAI_CONFIG } from "../kb/config.ts";
import { extractTextWithoutImages, extractImageUrls } from "../kb/tools.ts";
import type { MMItem } from "../kb/workflow-node/workflow-tools.ts";
import { connectDB } from "../tools.ts";

//类型定义
type DB = ReturnType<typeof connectDB>;
interface ExistingTag {
  name: string;
  description: string;
  usageCount: number;
}
interface AIAnalysisResult {
  name: string;
  description: string;
  confidence: number;
  reasoning?: string | null;
}
interface TimeRange {
  start: Date;
  end: Date;
}
const CONFIG = {
  MAX_EXISTING_TAGS: 50,
  MAX_DESCRIPTION_LENGTH: 24,
  MAX_REASONING_LENGTH: 50,
  AI_TEMPERATURE: 0.3,
  TAG_SIMILARITY_THRESHOLD: 0.7,
  DEFAULT_CONFIDENCE: 0.5,
} as const;

const hotIssueAnalysisSchema = z.object({
  name: z
    .string(),
  description: z
    .string()
    .max(CONFIG.MAX_DESCRIPTION_LENGTH),
  confidence: z
    .number()
    .min(0)
    .max(1),
  reasoning: z
    .string()
    .nullable()
    .optional(),
});
/**获取现有标签*/
async function getExistingTags(db: DB): Promise<ExistingTag[]> {
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
    .limit(CONFIG.MAX_EXISTING_TAGS);

  return tagResults.map((t) => ({
    name: t.name,
    description: t.description,
    usageCount: Number(t.usageCount),
  }));
}
//查找或创建标签
async function findOrCreateTag(
  db: DB,
  name: string,
  description: string
): Promise<number> {
  const existing = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.name, name))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    return existing[0].id;
  }
  const result = await db
    .insert(schema.tags)
    .values({
      name,
      description,
      isAiGenerated: true,
    })
    .returning({ id: schema.tags.id });

  if (!result[0]) {
    throw new Error(`创建标签失败: ${name}`);
  }
  return result[0].id;
}

//检查工单是否已关联标签
async function isTicketTagLinked(
  db: DB,
  ticketId: string,
  tagId: number
): Promise<boolean> {
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
  return existingLink.length > 0;
}
//关联工单和标签
async function linkTicketToTag(
  db: DB,
  ticketId: string,
  tagId: number,
  confidence: number
): Promise<void> {
  await db.insert(schema.ticketsTags).values({
    ticketId,
    tagId,
    confidence,
    isAiGenerated: true,
  });
}
function buildSystemPrompt(existingTags: ExistingTag[]): string {
  const tagsText = existingTags.length > 0
    ? existingTags
        .map((t) => `- ${t.name}: ${t.description} (使用次数: ${t.usageCount})`)
        .join("\n")
    : "暂无现有标签";

  return `你是 Sealos 工单系统的标签分析助手。请仅基于工单的“标题/描述/图片”生成结构化标签结果。

输出字段:
- name: 标签类别。优先复用现有标签（见下方列表）；相似度 ≥${CONFIG.TAG_SIMILARITY_THRESHOLD * 100}% 归入现有项；否则创建新的“类别名”，保持简洁（如：部署问题/网络问题/身份认证/镜像仓库/数据库）。
- description: 12-${CONFIG.MAX_DESCRIPTION_LENGTH} 个中文字符（不含空格），必须包含关键信息，且“严格≤${CONFIG.MAX_DESCRIPTION_LENGTH}字”，绝不允许超过。推荐模板：
  [模块/服务/系统名] + [现象/错误码/关键报错词] + [阶段/资源]
  示例：applaunchpad 镜像拉取失败 ImagePullBackOff
- confidence: 0-1 之间；信息不足或歧义高时 ≤0.6
- reasoning(可选): 简要说明依据或指出缺失信息（≤${CONFIG.MAX_REASONING_LENGTH}字）

强制要求:
- “description” 禁止仅输出“XX问题/信息不足”等泛化词；必须包含至少一项具体实体：
  - 模块/服务名（如: applaunchpad, devbox, ingress, registry, gateway, postgres, mysql, redis）
  - 资源或对象（如: Deployment/Pod/Job/Service/Ingress + 名称）
  - 错误码/关键词（如: ImagePullBackOff, CrashLoopBackOff, x509, ECONNREFUSED, 5xx, 404, TLS, 超时）
  - 阶段/操作（如: 启动/部署/登录/拉取/变更/升级/备份/恢复）
- 描述中出现的代码/标识符/错误关键词要如实保留原文，不要翻译或概括为“问题”。
- 如果文本或图片无法识别出“模块名/错误码/资源名”中的任意一类，降低 confidence，并在 reasoning 明确指出缺失项（如“缺少应用名/错误码”）。
 - 若用户输入包含大段“代码/日志”，忽略实现细节，不要复制粘贴长代码；只提取“模块名/资源名/错误关键词/错误码/阶段”这类短关键词到 description；必要时进行压缩以满足≤${CONFIG.MAX_DESCRIPTION_LENGTH}字。
 - description 必须为单行短语，不要包含换行或多余空格、不要添加标点装饰或引号。

判定流程建议:
1) 从标题/描述/图片中抽取命名实体与关键错误词（模块/资源/错误码/阶段/环境词：公网/内网/集群/租户/namespace）。
2) 先尝试与现有标签 name 匹配（≥${CONFIG.TAG_SIMILARITY_THRESHOLD * 100}%），命中则复用该 name；否则产出新的“类别性” name。
3) 用“模块/错误关键词/阶段或资源”拼成 description，控制在 12-${CONFIG.MAX_DESCRIPTION_LENGTH} 字，优先保留关键信息，避免冗余。
4) 无法确定则降低 confidence，并在 reasoning 说明“不足之处”。

现有标签（按使用频率排序）:
${tagsText}

正反例:

正例1
输入标题: "applaunchpad 部署失败 ImagePullBackOff"
输出:
{
  "name": "部署问题",
  "description": "applaunchpad 镜像拉取失败 ImagePullBackOff",
  "confidence": 0.86,
  "reasoning": "标题含模块与错误码，指向部署阶段镜像拉取失败"
}

正例2
输入标题: "编辑器打不开，页面 404"
输出:
{
  "name": "界面问题",
  "description": "devbox 页面 404 无法加载",
  "confidence": 0.82,
  "reasoning": "编辑器=devbox，现象为 404"
}

正例3
输入标题: "公网连接卡住，访问外网超时 30s"
输出:
{
  "name": "网络问题",
  "description": "公网 egress 超时 30s",
  "confidence": 0.8
}

正例4
输入标题: "数据库连接失败 ECONNREFUSED"
输出:
{
  "name": "数据库问题",
  "description": "postgres 连接失败 ECONNREFUSED",
  "confidence": 0.84
}

反例（禁止）:
- "应用无法启动" / "启动问题" / "信息不足" / "编辑器问题" / "公网连接问题"（过于泛化，缺少实体与错误关键词）
`;
}

//构建用户提示词
function buildUserContent(
  title: string,
  description: JSONContentZod
): MMItem[] {
  // 构建提示文本
  const prompt = `标题: ${title}
描述: ${extractTextWithoutImages(description)}`;
  const content: MMItem[] = [
    { type: "text", text: prompt }
  ];
  const imageUrls = extractImageUrls(description);
  imageUrls.slice(0, 6).forEach((url) => {
    content.push({
      type: "image_url",
      image_url: { url }
    });
  });
  return content;
}

//使用 AI 分析工单内容
async function analyzeWithAI(
  title: string,
  description: JSONContentZod,
  existingTags: ExistingTag[]
): Promise<AIAnalysisResult> {
  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.analysisModel,
    temperature: CONFIG.AI_TEMPERATURE,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });
  const systemPrompt = buildSystemPrompt(existingTags);
  const userContent = buildUserContent(title, description);
  const structuredModel = model.withStructuredOutput(hotIssueAnalysisSchema);
  const result = await structuredModel.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]);
  return {
    name: result.name || "其他问题",
    description: result.description || "未明确分类的问题",
    confidence: Math.min(Math.max(result.confidence || CONFIG.DEFAULT_CONFIDENCE, 0), 1),
    reasoning: result.reasoning,
  };
}

//分析并保存工单
export async function analyzeAndSaveHotIssue(
  db: DB,
  ticketId: string,
  title: string,
  description: JSONContentZod
): Promise<void> {
  if (!OPENAI_CONFIG.apiKey) {
    throw new Error("OPENAI_API_KEY 未配置");
  }
  if (!OPENAI_CONFIG.analysisModel) {
    throw new Error("ANALYSIS_MODEL 未配置");
  }

  const existingTags = await getExistingTags(db);
  const analysis = await analyzeWithAI(title, description, existingTags);
  const tagId = await findOrCreateTag(db, analysis.name, analysis.description);
  const isLinked = await isTicketTagLinked(db, ticketId, tagId);
  
  if (!isLinked) {
    await linkTicketToTag(db, ticketId, tagId, analysis.confidence);
  }
}

//获取热点问题统计数据
export async function getHotIssuesStats(
  db: DB,
  timeRange: TimeRange
) {
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