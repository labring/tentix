import * as schema from "@/db/schema.ts";
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import type { Context } from "hono";
import { z } from "zod";
import "zod-openapi/extend";
import {
  factory,
  authMiddleware,
  staffOnlyMiddleware,
  adminOnlyMiddleware,
} from "../middleware.ts";
import { emit, Events } from "@/utils/events/kb/bus";
import { HTTPException } from "hono/http-exception";
import { detectLocale } from "@/utils/i18n";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { logWarning } from "@/utils/log";
import { OPENAI_CONFIG, SOURCE_WEIGHTS } from "@/utils/kb/config";
import {
  loadEditedKnowledgeSourceContext,
  rebuildEditedKnowledgeMetadata,
} from "@/utils/kb/kb-builder";
import { getTextWithImageInfo } from "@/utils/kb/tools";
import type { JSONContentZod } from "@/utils/types";
import {
  KNOWLEDGE_FILE_MAX_BYTES,
  KNOWLEDGE_FILE_MAX_CANDIDATES,
  KNOWLEDGE_FILE_MAX_CONTENT_LENGTH,
  normalizeKnowledgeDuplicateContent,
  splitKnowledgeFile,
  KnowledgeFileParseError,
  type KnowledgeFileCandidate,
} from "@/utils/kb/file-import.ts";
import { parseKnowledgeFile } from "@/utils/kb/file-parsers.ts";

const createFavoritedSchema = z.object({
  ticketId: z.string(),
  messageIds: z.array(z.number().int()).optional(),
  favoritedBy: z.number().int().positive(),
});

const createFavoritedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({ id: z.number(), syncStatus: z.string() }),
});

const knowledgeSourceTypeValues = [
  "favorited_conversation",
  "historical_ticket",
  "general_knowledge",
] as const;

const knowledgeListQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).optional(),
    pageSize: z.string().regex(/^\d+$/).optional(),
    keyword: z.string().optional(),
    sourceType: z.enum(["all", ...knowledgeSourceTypeValues]).optional(),
    module: z.string().optional(),
    status: z.enum(["all", "enabled", "disabled"]).optional(),
    failedOnly: z.enum(["true"]).optional(),
  })
  .strict();

const knowledgeSourceParamsSchema = z.object({
  sourceType: z.enum(knowledgeSourceTypeValues),
  sourceId: z.string().min(1),
});

const knowledgeUpdateSchema = z
  .object({
    chunks: z
      .array(
        z.object({
          id: z.string().uuid(),
          content: z.string().trim().min(1, "内容不能为空").max(20000),
        }),
      )
      .optional(),
  })
  .strict()
  .refine((value) => value.chunks !== undefined, {
    message: "至少提供一个要更新的片段",
  });

const generalKnowledgeSourceIdRegex =
  /^general_knowledge:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/;

const generalKnowledgeCategoryValues = [
  "troubleshooting",
  "feature",
  "billing",
  "operation",
  "other",
] as const;

const createGeneralKnowledgeSchema = z
  .object({
    sourceId: z
      .string()
      .trim()
      .regex(generalKnowledgeSourceIdRegex)
      .max(200),
    title: z.string().trim().min(1).max(200),
    modules: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(10),
    category: z.enum(generalKnowledgeCategoryValues),
    docName: z.string().trim().max(200).optional(),
    revision: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(20000),
    indexes: z
      .array(z.string().trim().min(1).max(500))
      .max(3)
      .optional(),
  })
  .strict();

const createGeneralKnowledgeResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    sourceType: z.literal("general_knowledge"),
    sourceId: z.string(),
    chunkCount: z.number(),
  }),
});

const generateGeneralKnowledgeIndexesSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    modules: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(10),
    category: z.enum(generalKnowledgeCategoryValues),
    content: z.string().trim().min(1).max(20000),
  })
  .strict();

const knowledgeFilePreviewSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/\.(?:md|txt|html|pdf|docx|csv|xlsx)$/i),
    fileSizeBytes: z.number().int().positive().max(KNOWLEDGE_FILE_MAX_BYTES),
    rawText: z.string(),
    chunkSettingMode: z.enum(["auto", "custom"]),
    chunkSplitMode: z.enum(["paragraph", "size", "char"]).optional(),
    paragraphChunkDeep: z.number().int().min(1).max(8).optional(),
    chunkSize: z.number().int().min(64).max(4000).optional(),
    chunkSplitter: z.string().max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const actualTextBytes = new TextEncoder().encode(value.rawText).byteLength;
    if (actualTextBytes > KNOWLEDGE_FILE_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rawText"],
        message: "file_size",
      });
    }
  });

const knowledgeFileDuplicateSchema = z
  .object({
    candidates: z
      .array(
        z.object({
          candidateId: z.string().min(1).max(80),
          content: z.string().trim().min(1).max(KNOWLEDGE_FILE_MAX_CONTENT_LENGTH),
        }),
      )
      .max(KNOWLEDGE_FILE_MAX_CANDIDATES),
  })
  .strict();

type KnowledgeTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

type KnowledgeValidationIssue = {
  path: readonly PropertyKey[];
  code?: string;
  maximum?: number | bigint;
};

type KnowledgeValidationResult =
  | { success: true }
  | {
      success: false;
      error: { issues: readonly KnowledgeValidationIssue[] };
    };

function getKnowledgeValidationMessage(
  issue: KnowledgeValidationIssue,
  t: KnowledgeTranslator,
): string {
  const path = issue.path.join(".");
  if (path === "sourceId" && issue.code === "invalid_string") {
    return t("knowledge_error.source_id");
  }
  if (path === "title" && issue.code === "too_small") {
    return t("knowledge_error.title_required");
  }
  if (path === "modules" && issue.code === "too_small") {
    return t("knowledge_error.modules_required");
  }
  if (path === "modules" && issue.code === "too_big") {
    return t("knowledge_error.modules_max", { max: issue.maximum });
  }
  if (path === "category") return t("knowledge_error.category_required");
  if (path === "revision" && issue.code === "too_small") {
    return t("knowledge_error.revision_required");
  }
  if (path === "content" && issue.code === "too_small") {
    return t("knowledge_error.content_required");
  }
  if (path === "indexes" && issue.code === "too_big") {
    return t("knowledge_error.indexes_max");
  }
  if (path.startsWith("indexes.") && issue.code === "too_big") {
    return t("knowledge_error.index_max", { max: issue.maximum });
  }
  if (path === "fileName" && issue.code === "invalid_string") {
    return t("knowledge_error.file_extension");
  }
  if (path === "fileSizeBytes" || path === "rawText") {
    return t("knowledge_error.file_size");
  }
  if (path === "title" && issue.code === "too_big") {
    return t("knowledge_error.title_max", { max: issue.maximum });
  }
  if (path === "chunkSplitter" && issue.code === "too_big") {
    return t("knowledge_error.chunk_splitter");
  }
  return t("knowledge_error.invalid_request");
}

function knowledgeValidationHook(
  result: KnowledgeValidationResult,
  c: Context,
): void {
  if (!result.success) {
    const t = c.get("i18n").getFixedT(detectLocale(c));
    throw new HTTPException(422, {
      message: getKnowledgeValidationMessage(result.error.issues[0]!, t),
    });
  }
}

const generatedGeneralKnowledgeIndexesSchema = z.object({
  indexes: z
    .array(z.string().trim().min(1).max(500))
    .max(3)
    .describe("用于召回通用知识的用户视角入口问题，最多 3 条"),
});

const generateGeneralKnowledgeIndexesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    indexes: z.array(z.string()),
  }),
});

const knowledgeChunkParamsSchema = z.object({
  id: z.string().uuid(),
});

const knowledgeChunkUpdateSchema = z
  .object({
    isDeleted: z.boolean(),
  })
  .strict();

type KnowledgeListQuery = z.infer<typeof knowledgeListQuerySchema>;

const editedKnowledgeEmbedder = new OpenAIEmbeddings({
  apiKey: OPENAI_CONFIG.apiKey,
  model: OPENAI_CONFIG.embeddingModel,
  dimensions: 3072,
  configuration: {
    baseURL: OPENAI_CONFIG.baseURL,
  },
  batchSize: 16,
  timeout: 60_000,
  maxRetries: 3,
});

function hashKnowledgeContent({
  sourceType,
  sourceId,
  chunkId,
  content,
}: {
  sourceType: string;
  sourceId: string;
  chunkId: number;
  content: string;
}): string {
  return Bun.hash(`${sourceType}:${sourceId}:${chunkId}:${content}`).toString();
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? Number(x).toFixed(6) : "0")).join(",")}]`;
}

async function embedEditedKnowledgeContent(text: string): Promise<string> {
  const input = text.replace(/\s+/g, " ").slice(0, 8000);
  const emb = await editedKnowledgeEmbedder.embedQuery(input);
  return toPgVectorLiteral(emb);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await mapper(items[index]!, index);
      }
    }),
  );
  return results;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildKnowledgeWhere(
  query: KnowledgeListQuery,
  failedSourceIds?: string[],
): SQL | undefined {
  const conditions: SQL[] = [];
  const sourceType = query.sourceType ?? "all";
  const keyword = query.keyword?.trim();
  const module = query.module?.trim();

  if (sourceType !== "all") {
    conditions.push(eq(schema.knowledgeBase.sourceType, sourceType));
  }

  if (module) {
    conditions.push(sql`(
      (${schema.knowledgeBase.sourceType} <> 'general_knowledge'
        AND ${schema.knowledgeBase.metadata} ->> 'module' = ${module})
      OR
      (${schema.knowledgeBase.sourceType} = 'general_knowledge'
        AND (
          ${schema.knowledgeBase.metadata} ->> 'module' = ${module}
          OR (${schema.knowledgeBase.metadata} -> 'modules') ? ${module}
        ))
    )`);
  }

  if (failedSourceIds) {
    conditions.push(eq(schema.knowledgeBase.sourceType, "favorited_conversation"));
    conditions.push(inArray(schema.knowledgeBase.sourceId, failedSourceIds));
  }

  if (keyword) {
    const pattern = `%${keyword}%`;
    const keywordCondition = or(
      ilike(schema.knowledgeBase.title, pattern),
      ilike(schema.knowledgeBase.content, pattern),
      ilike(schema.knowledgeBase.sourceId, pattern),
      sql`CAST(${schema.knowledgeBase.metadata} AS TEXT) ILIKE ${pattern}`,
    );
    if (keywordCondition) {
      conditions.push(keywordCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildKnowledgeStatusHaving(status: KnowledgeListQuery["status"]): SQL | undefined {
  const disabledCount = sql<number>`COALESCE(SUM(CASE WHEN ${schema.knowledgeBase.isDeleted} THEN 1 ELSE 0 END), 0)`;
  const totalCount = sql<number>`COUNT(*)`;
  if (status === "enabled") return sql`${disabledCount} < ${totalCount}`;
  if (status === "disabled") return sql`${disabledCount} > 0`;
  return undefined;
}

function getMetadataValue(metadata: unknown, key: string): unknown {
  if (!metadata || typeof metadata !== "object") return undefined;
  return (metadata as Record<string, unknown>)[key];
}

function getMetadataString(metadata: unknown, key: string): string {
  const value = getMetadataValue(metadata, key);
  return typeof value === "string" ? value : "";
}

function getMetadataStringArray(metadata: unknown, key: string): string[] {
  const value = getMetadataValue(metadata, key);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeStringList(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((item) => item.trim()).filter(Boolean)),
  );
}

function normalizeGeneratedIndexes(values: string[] | undefined): string[] {
  return normalizeStringList(values)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 500)
    .slice(0, 3);
}

async function generateGeneralKnowledgeRecallIndexes(
  payload: z.infer<typeof generateGeneralKnowledgeIndexesSchema>,
  t: KnowledgeTranslator,
): Promise<string[]> {
  if (!OPENAI_CONFIG.apiKey || !OPENAI_CONFIG.summaryModel) {
    throw new HTTPException(503, {
      message: t("knowledge_error.index_not_configured"),
    });
  }

  const model = new ChatOpenAI({
    apiKey: OPENAI_CONFIG.apiKey,
    model: OPENAI_CONFIG.summaryModel,
    temperature: 0.2,
    configuration: {
      baseURL: OPENAI_CONFIG.baseURL,
    },
  });
  const structured = model.withStructuredOutput(generatedGeneralKnowledgeIndexesSchema);
  const sealosCalibration =
    global.customEnv.TARGET_PLATFORM === "sealos"
      ? [
          "",
          "Sealos 官方部署补充语境：",
          "- 用户问法可能直接包含 DevBox、应用管理、IDE、SSH、Cursor、Trae、公网地址、随机域名、备案码、对象存储等 Sealos 业务对象。",
          "- Ingress pending、LoadBalancer、Service ExternalIP、OOM、端口监听等内部实现或诊断证据默认不得作为索引；仅当对应 token 本身就是用户会直接说出或复制粘贴的原始报错/状态时，才允许保留。",
          "",
          "Sealos 官方部署校准例子：",
          "- 知识正文说“运行模型、构建任务、安装依赖可能导致 DevBox 重启”，不要生成“DevBox 运行大模型或执行构建任务时自动重启了”，应只保留一条重启入口，例如“DevBox反复重启”。",
          "- 知识正文说“内存 80%-90% 以上会导致 DevBox 重启”，不要生成“DevBox 启动服务后一直重启，看监控内存快满了”，应改为“DevBox反复重启”。",
          "- 知识正文说“资源不足或 OOM 会导致 DevBox 重启”，不要生成“内存不足导致DevBox反复重启”，应改为“DevBox一直重启”。",
          "- 知识正文说“CPU 和内存长期都很高说明配置不足”，不要生成“CPU和内存都很高导致DevBox重启”，应改为“DevBox总是重启”。",
          "- 知识正文说“运行中断开可能和资源有关”，不要生成“资源不足导致SSH断开”，应改为“SSH总是断开”或“DevBox用着用着断开”。",
          "- 知识正文说“自定义域名未备案会导致公网地址准备中”，不要生成“自定义域名状态一直卡在准备中”，应改为“公网地址一直准备中”。",
          "- 知识正文说“Sealos 随机域名需要服务监听端口”，不要生成“Sealos分配的随机域名无法访问，显示准备中”，应改为“公网调试地址一直准备中”或“DevBox公网调试地址准备中”。",
          "- 知识正文说“执行 ss -tnlp 检查端口监听”，不要生成“ss -tnlp 检查端口监听”，因为这是排查动作，不是用户首问。",
          "- 功能/配置知识正文说“可以绑定自定义域名”，可以生成“怎么绑定自定义域名”或“自定义域名怎么配置”。",
          "- 计费知识正文说“关机后仍会产生存储费用”，可以生成“关机了为什么还扣费”或“关机后还会扣费吗”。",
          "- 规则/限制知识正文说“对象存储有容量或权限限制”，可以生成“对象存储有什么限制”或“对象存储能不能扩容”。",
          "- 操作知识正文说“备案授权码在控制台查看”，可以生成“备案授权码在哪里看”。",
        ]
      : [];
  const promptText = [
    "你在为 Tentix AI 客服的通用知识生成召回索引。",
    "召回索引会作为独立向量 chunk 入库，用于匹配用户原始问题或系统生成的短检索词。",
    "因此 indexes 的目标不是复述知识正文，也不是生成客服诊断标签，而是覆盖“用户尚未被诊断前会怎么问”。",
    "好的 indexes 应该落在用户原始表达和系统检索 query 的交集：用户看得见、说得出口，检索 query 也大概率会保留。",
    "输出必须是严格 JSON，结构为：",
    '{ "indexes": string[] }',
    "",
    "最重要的判断标准：",
    "1) indexes 必须像真实客户的入口问题，而不是像客服、研发、系统或知识库作者的归纳标题。",
    "2) 优先写用户直接关心或观察到的对象、页面、产品、状态、错误、限制或目标操作。",
    "3) 对故障排查类知识，用户首问现象和诊断证据必须分开：系统监控指标、内部状态、权限校验结果、资源余量默认属于诊断证据，不作为索引。",
    "4) 用户通常不会在首问中准确说出根因、诊断分支、内部实现、排查命令、触发场景或处理步骤；这些内容不要作为索引。",
    "5) 可以做口语化归纳，但归纳后的句子仍必须是用户可能会问出口的话。",
    "6) 不套固定模板。不要为了整齐而机械拼接“对象 + 动作/状态”。",
    "7) 可以保留用户会复制粘贴的精确 token，例如错误码、英文报错、状态名、页面名、按钮名、产品名。",
    "",
    "常见客服问法方向，仅用于判断语境，禁止机械套用：",
    "- 状态卡住：用户会说“一直准备中 / 执行中 / 变更中 / 创建中 / 卡住”，通常不会先说明原因。",
    "- 连接失败：用户会说“打不开 / 连不上 / 访问不了 / 不通 / 连接失败”，常带页面、客户端、接口、数据库、设备等对象。",
    "- 中断或反复失败：用户会说“反复失败 / 用着用着断开 / 总是中断 / 一直重试”，通常不会先说明内部原因。",
    "- 运行报错：用户会说“启动不了 / 运行失败 / 一直重启 / 报错”，也可能直接贴错误原文。",
    "- 配置咨询：用户会问“怎么配置 / 如何部署 / 是否支持 / 能不能 / 在哪里看 / 怎么绑定”。",
    "- 账号计费：用户会说“为什么扣费 / 退款没到账 / 发票没收到 / 充值失败 / 登录不了”。",
    "- 文件权限：用户会说“空间不足 / 权限不够 / 上传不了 / 怎么扩容 / 怎么备份导出”。",
    "",
    "生成策略：",
    "1) 先从正文里找“用户首问入口”：用户能看到的现象、想完成的动作、遇到的限制、复制到的报错、页面/产品名、计费或账号困惑。",
    "2) 再丢弃“答案侧信息”：根因、诊断分支、排查命令、客服话术、处理步骤、内部组件名；对故障排查类知识还要丢弃触发场景、诊断证据、监控指标。",
    "3) 每条 index 只覆盖一个用户首问入口；对故障排查类知识，不要把现象、触发场景和诊断证据揉成一条。",
    "4) 优先生成 1-3 条语义入口不同的自然短句；“不同”指用户进入这条知识的路径不同，换一种说法表达同一个现象不算不同（例如“一直重启”“自动重启”“反复重启”是同一条）；如果找不到第二个真实语义入口，只输出 1 条，不用同义词轮换凑数。",
    "5) 对排障知识，索引应像症状首问，例如“打不开 / 一直准备中 / 连不上 / 启动不了 / 一直重启 / 自动重启”。",
    "6) 对教程/配置知识，索引应像“怎么做 / 是否支持 / 在哪里配置 / 怎么绑定”。",
    "7) 对规则/限制知识，索引应像“为什么不行 / 能不能 / 有什么限制”。",
    "8) 对账号、计费、退款、发票类知识，索引应保留用户实际关心的动作或困惑。",
    "9) 对错误日志类知识，可把最核心的错误原文作为一条索引，但不要扩写成解决方案标题。",
    "",
    "禁止作为索引的内容：",
    "- 根因或诊断分支：例如“权限校验失败”“内部服务未启动”“库存不足”“规则未满足”。",
    "- 对故障排查类知识，禁止把触发场景枚举作为索引：例如“活动高峰时”“批量导入时”“切换网络后”“升级版本后”。",
    "- 对故障排查类知识，禁止把诊断证据或监控指标作为索引：例如“内部监控告警”“资源占用较高”“审计记录异常”“后台状态截图”。",
    "- 内部实现或系统视角：例如内部服务 ID、队列状态、策略标签、调度结果。",
    "- 排查动作：例如“查询后台日志”“核对内部记录”“收集截图”。",
    "- 客服流程或话术：例如“先确认用户使用的账号和操作入口”。",
    "- 完整答案：例如“因为权限校验失败导致操作被拒绝”。",
    "只有当这些词本身就是用户会直接说出口或复制粘贴的错误原文时，才允许保留。",
    "",
    "生成后逐条自检，不通过就删除或改写：",
    "1) 这句话像真实客户首问吗？如果更像客服/研发/系统归纳，改掉。",
    "2) 这句话是否要求用户已经知道诊断前提？如果是，改成用户可见现象。",
    "3) 这句话是否包含排查动作或解决方案？如果是，删除这些答案侧内容。",
    "4) 对故障排查类知识，这句话是否包含正文里的触发场景、诊断证据或监控指标？如果是，改成不带前提的症状首问。",
    "5) 去掉知识正文里的根因、场景和指标后，这句话还能表达用户问题吗？不能就不输出。",
    "",
    "通用校准例子：",
    "- 知识正文说“风控校验未通过会导致账号登录失败”，不要生成“风控校验未通过导致账号登录失败”，应改为“账号登录不了”。",
    "- 知识正文说“库存不足会导致订单无法提交”，不要生成“库存不足导致订单提交失败”，应改为“订单为什么提交不了”。",
    "- 知识正文说“文件格式或大小不符合要求会导致上传失败”，不要生成具体诊断结论，应改为“文件为什么上传失败”。",
    "- 计费知识正文说“退款审核通过后原路退回”，可以生成“退款什么时候到账”或“退款进度在哪里看”。",
    "- 操作知识正文说“可以在账户设置中修改通知方式”，可以生成“通知方式在哪里修改”。",
    ...sealosCalibration,
    "",
    "生成规则：",
    "1) indexes 最多 3 条；每条优先控制在 6-40 个中文字符，硬上限 80 字。",
    "2) 必须只使用标题、模块、分类、正文中能支持的信息；可以做口语化改写，但不能新增正文没有的产品、错误、限制或场景。",
    "3) 禁止输出泛词：问题、报错、异常、故障、解决方法、怎么解决、[图片]、是的、需要、好的。",
    "4) 禁止输出排查动作，除非用户会直接把该命令、错误码或配置项当作问题来问。",
    "5) 禁止输出包含完整答案的索引，例如“因为 X 导致 Y”“通过 X 解决 Y”。",
    "6) 如果正文只适合作为客服内部流程，缺少用户会搜索的对象、症状、错误、限制或目标操作，返回空数组。",
    "7) 对故障排查类知识，不为了凑满 3 条而引入触发场景、诊断证据或监控指标；只有 1-2 条自然首问时就输出 1-2 条。",
    "8) 输出前按自然度排序：最像真实客户问题的放前面，诊断味更重的不要输出。",
    "",
    "通用知识信息：",
    `- 标题: ${payload.title}`,
    `- 适用模块: ${payload.modules.join(", ")}`,
    `- 分类: ${payload.category}`,
    "",
    "正式知识正文：",
    payload.content,
  ].join("\n");

  try {
    const result = await structured.invoke(promptText);
    return normalizeGeneratedIndexes(result.indexes);
  } catch (err) {
    logWarning(
      `[kb.admin.generateGeneralKnowledgeIndexes] failed: ${String(err)}`,
    );
    throw new HTTPException(502, {
      message: t("knowledge_error.index_generation_failed"),
    });
  }
}

function parseGeneralKnowledgeSourceId(sourceId: string): {
  sourceDocId: string;
  entrySlug: string;
} {
  const match = generalKnowledgeSourceIdRegex.exec(sourceId);
  if (!match?.[1] || !match?.[2]) {
    throw new HTTPException(400, {
      message: "Invalid general knowledge sourceId",
    });
  }
  return { sourceDocId: match[1], entrySlug: match[2] };
}

function getUserDisplayName(user: {
  realName?: string | null;
  nickname?: string | null;
  name?: string | null;
  id?: number | null;
}): string {
  return (
    user.realName?.trim() ||
    user.nickname?.trim() ||
    user.name?.trim() ||
    (user.id ? `用户 ${user.id}` : "未知用户")
  );
}

function getUserRoleLabel(role: string | null | undefined): string {
  if (role === "admin") return "管理员";
  if (role === "agent") return "客服";
  if (role === "technician") return "技术";
  if (role === "ai") return "AI";
  if (role === "customer") return "用户";
  return role || "未知角色";
}

function getFavoriteSelectionMode(messageIds: number[] | null | undefined) {
  return messageIds && messageIds.length > 0
    ? "selected_messages"
    : "entire_conversation";
}

async function loadFavoritedSourceMessages(
  db: any,
  ticketId: string,
  messageIds: number[] | null | undefined,
) {
  const rows = await db
    .select({
      id: schema.chatMessages.id,
      ticketId: schema.chatMessages.ticketId,
      senderId: schema.chatMessages.senderId,
      content: schema.chatMessages.content,
      createdAt: schema.chatMessages.createdAt,
      isInternal: schema.chatMessages.isInternal,
      withdrawn: schema.chatMessages.withdrawn,
      senderName: schema.users.name,
      senderNickname: schema.users.nickname,
      senderRealName: schema.users.realName,
      senderRole: schema.users.role,
    })
    .from(schema.chatMessages)
    .leftJoin(schema.users, eq(schema.chatMessages.senderId, schema.users.id))
    .where(
      messageIds && messageIds.length > 0
        ? and(
            eq(schema.chatMessages.ticketId, ticketId),
            inArray(schema.chatMessages.id, messageIds),
          )
        : eq(schema.chatMessages.ticketId, ticketId),
    )
    .orderBy(asc(schema.chatMessages.createdAt));

  return rows.map((row: (typeof rows)[number]) => ({
    id: row.id,
    ticketId: row.ticketId,
    senderId: row.senderId,
    senderName: getUserDisplayName({
      id: row.senderId,
      name: row.senderName,
      nickname: row.senderNickname,
      realName: row.senderRealName,
    }),
    senderRole: row.senderRole,
    senderRoleLabel: getUserRoleLabel(row.senderRole),
    createdAt: row.createdAt,
    isInternal: Boolean(row.isInternal),
    withdrawn: Boolean(row.withdrawn),
    contentText: getTextWithImageInfo(row.content as JSONContentZod),
  }));
}

const kbRouter = factory
  .createApp()
  .use(authMiddleware)
  .use(staffOnlyMiddleware())
  .post(
    "/admin/general-knowledge/file/parse",
    adminOnlyMiddleware(),
    async (c) => {
      const t = c.get("i18n").getFixedT(detectLocale(c));
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new HTTPException(422, { message: t("knowledge_error.file_parse_failed") });
      }

      const uploaded = form.get("file");
      if (!(uploaded instanceof File)) {
        throw new HTTPException(422, { message: t("knowledge_error.file_missing") });
      }
      const fileName = uploaded.name.trim();
      if (uploaded.size > KNOWLEDGE_FILE_MAX_BYTES) {
        throw new HTTPException(422, { message: t("knowledge_error.file_size") });
      }
      if (!fileName || fileName.length > 200) {
        throw new HTTPException(422, { message: t("knowledge_error.file_name") });
      }

      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await uploaded.arrayBuffer());
      } catch {
        throw new HTTPException(422, { message: t("knowledge_error.file_read") });
      }

      try {
        const result = await parseKnowledgeFile({ fileName, bytes });
        return c.json({
          success: true,
          data: {
            fileName,
            fileSizeBytes: uploaded.size,
            rawText: result.rawText,
            warnings: result.warningKeys.map((key) => t(key)),
          },
        });
      } catch (error) {
        if (error instanceof KnowledgeFileParseError) {
          throw new HTTPException(422, { message: t(error.translationKey) });
        }
        throw error;
      }
    },
  )
  .post(
    "/admin/general-knowledge/file/preview",
    adminOnlyMiddleware(),
    zValidator("json", knowledgeFilePreviewSchema, knowledgeValidationHook),
    async (c) => {
      const payload = c.req.valid("json");
      let candidates: KnowledgeFileCandidate[];
      try {
        candidates = splitKnowledgeFile(payload.rawText, {
          chunkSettingMode: payload.chunkSettingMode,
          chunkSplitMode: payload.chunkSplitMode,
          paragraphChunkDeep: payload.paragraphChunkDeep,
          chunkSize: payload.chunkSize,
          chunkSplitter: payload.chunkSplitter,
        });
      } catch (error) {
        if (error instanceof KnowledgeFileParseError) {
          const t = c.get("i18n").getFixedT(detectLocale(c));
          throw new HTTPException(422, { message: t(error.translationKey) });
        }
        throw error;
      }
      if (!candidates.length) {
        const t = c.get("i18n").getFixedT(detectLocale(c));
        throw new HTTPException(422, { message: t("knowledge_error.file_no_text") });
      }

      return c.json({
        success: true,
        data: {
          fileName: payload.fileName,
          candidates: candidates.map((candidate: KnowledgeFileCandidate) => ({
            candidateId: crypto.randomUUID(),
            title: candidate.title,
            content: candidate.content,
          })),
          total: candidates.length,
        },
      });
    },
  )
  .post(
    "/admin/general-knowledge/file/duplicates",
    adminOnlyMiddleware(),
    zValidator("json", knowledgeFileDuplicateSchema),
    async (c) => {
      const db = c.var.db;
      const payload = c.req.valid("json");
      const normalizedCandidates = payload.candidates.map((candidate) => ({
        ...candidate,
        normalizedContent: normalizeKnowledgeDuplicateContent(candidate.content),
      }));
      const existing = await db
        .select({
          sourceId: schema.knowledgeBase.sourceId,
          title: schema.knowledgeBase.title,
          content: schema.knowledgeBase.content,
          metadata: schema.knowledgeBase.metadata,
        })
        .from(schema.knowledgeBase)
        .where(
          and(
            eq(schema.knowledgeBase.sourceType, "general_knowledge"),
            eq(schema.knowledgeBase.chunkId, 0),
          ),
        );
      type ExistingKnowledge = (typeof existing)[number];
      const existingByContent = new Map<string, ExistingKnowledge[]>();
      for (const row of existing) {
        const key = normalizeKnowledgeDuplicateContent(row.content);
        const rows = existingByContent.get(key) ?? [];
        rows.push(row);
        existingByContent.set(key, rows);
      }

      return c.json({
        success: true,
        data: {
          matches: normalizedCandidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            existing: (existingByContent.get(candidate.normalizedContent) ?? []).map((row) => {
              const metadata = row.metadata as Record<string, unknown>;
              return {
                sourceId: row.sourceId,
                title: row.title,
                modules: Array.isArray(metadata.modules) ? metadata.modules : [],
                category: metadata.category ?? "other",
              };
            }),
          })),
        },
      });
    },
  )
  .post(
    "/favorited",
    describeRoute({
      tags: ["KB"],
      description:
        "Create or update favoritedConversationsKnowledge and rebuild knowledge base",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Favorited knowledge processed successfully",
          content: {
            "application/json": {
              schema: resolver(createFavoritedResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("json", createFavoritedSchema),
    async (c) => {
      const db = c.var.db;
      const { ticketId, messageIds, favoritedBy } = c.req.valid("json");
      // BUG: 需要判断并发处理，对处理中的记录不进行处理，对已经处理的进行删除重建

      // 1) 查询是否已有收藏记录
      const existed = await db.query.favoritedConversationsKnowledge.findFirst({
        where: eq(schema.favoritedConversationsKnowledge.ticketId, ticketId),
      });

      let recordId: number;

      if (!existed) {
        // 2) 创建收藏记录（首次）
        const [created] = await db
          .insert(schema.favoritedConversationsKnowledge)
          .values({
            ticketId,
            messageIds: messageIds ?? [],
            favoritedBy,
            syncStatus: "pending",
            syncedAt: null,
          })
          .returning();

        if (!created) {
          return c.json(
            {
              success: false,
              message: "Failed to create favorited knowledge",
              data: null,
            },
            500,
          );
        }

        recordId = created.id;

        emit(Events.KBFavoritesSync, created);
      } else {
        if (existed.syncStatus === "processing") {
          return c.json({
            success: true,
            message: "Favorited knowledge is already processing",
            data: { id: existed.id, syncStatus: "processing" },
          });
        }

        // 2') 已存在：先清理对应 KB，再更新记录
        await db
          .delete(schema.knowledgeBase)
          .where(
            and(
              eq(schema.knowledgeBase.sourceType, "favorited_conversation"),
              eq(schema.knowledgeBase.sourceId, ticketId),
            ),
          );

        const [updated] = await db
          .update(schema.favoritedConversationsKnowledge)
          .set({
            messageIds: messageIds ?? [],
            favoritedBy,
            syncStatus: "pending",
            syncedAt: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.favoritedConversationsKnowledge.ticketId, ticketId))
          .returning();

        if (!updated) {
          return c.json(
            {
              success: false,
              message: "Failed to update favorited knowledge",
              data: null,
            },
            500,
          );
        }

        recordId = updated.id;

        emit(Events.KBFavoritesSync, updated);
      }

      return c.json({
        success: true,
        message: "Favorited knowledge processed successfully",
        data: { id: recordId, syncStatus: "pending" },
      });
    },
  )
  .post(
    "/admin/general-knowledge/indexes/generate",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Generate recall indexes for a general knowledge draft",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Recall indexes generated successfully",
          content: {
            "application/json": {
              schema: resolver(generateGeneralKnowledgeIndexesResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("json", generateGeneralKnowledgeIndexesSchema, knowledgeValidationHook),
    async (c) => {
      const payload = c.req.valid("json");
      const t = c.get("i18n").getFixedT(detectLocale(c));
      const indexes = await generateGeneralKnowledgeRecallIndexes(payload, t);
      return c.json({
        success: true,
        data: { indexes },
      });
    },
  )
  .post(
    "/admin/general-knowledge",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Create or replace one general knowledge source",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "General knowledge imported successfully",
          content: {
            "application/json": {
              schema: resolver(createGeneralKnowledgeResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("json", createGeneralKnowledgeSchema, knowledgeValidationHook),
    async (c) => {
      const db = c.var.db;
      const payload = c.req.valid("json");
      const sourceId = payload.sourceId;
      const { sourceDocId, entrySlug } = parseGeneralKnowledgeSourceId(sourceId);
      const modules = normalizeStringList(payload.modules);
      const indexes = normalizeStringList(payload.indexes).slice(0, 3);
      const primaryModule = modules[0]!;
      const commonMetadata = {
        module: primaryModule,
        modules,
        category: payload.category,
        source_doc_id: sourceDocId,
        entry_slug: entrySlug,
        doc_name: payload.docName ?? "",
        revision: payload.revision,
        entry_title: payload.title,
        review_status: "approved",
        parent_chunk_id: 0,
      };
      const docs = [
        {
          chunkId: 0,
          title: payload.title,
          content: payload.content,
          metadata: {
            ...commonMetadata,
            is_summary: true,
            chunk_role: "content",
            generated_indexes: indexes,
          },
        },
        ...indexes.map((content, index) => ({
          chunkId: index + 1,
          title: `${payload.title}（召回索引）`,
          content,
          metadata: {
            ...commonMetadata,
            is_summary: false,
            chunk_role: "index",
          },
        })),
      ];

      const rows = await mapWithConcurrency(docs, 2, async (doc) => {
        const embedding = await embedEditedKnowledgeContent(doc.content);
        return {
          sourceType: "general_knowledge" as const,
          sourceId,
          chunkId: doc.chunkId,
          title: doc.title,
          content: doc.content,
          embedding,
          metadata: doc.metadata,
          contentHash: hashKnowledgeContent({
            sourceType: "general_knowledge",
            sourceId,
            chunkId: doc.chunkId,
            content: doc.content,
          }),
          score: Math.round((SOURCE_WEIGHTS.general_knowledge ?? 0.5) * 100),
        };
      });

      await db.transaction(async (tx) => {
        await tx
          .delete(schema.knowledgeBase)
          .where(
            and(
              eq(schema.knowledgeBase.sourceType, "general_knowledge"),
              eq(schema.knowledgeBase.sourceId, sourceId),
            ),
          );

        await tx.insert(schema.knowledgeBase).values(
          rows.map((row) => ({
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            chunkId: row.chunkId,
            title: row.title,
            content: row.content,
            embedding: sql`${row.embedding}::tentix.vector(3072)`,
            metadata: row.metadata,
            contentHash: row.contentHash,
            score: row.score,
          })),
        );
      });

      return c.json({
        success: true,
        data: {
          sourceType: "general_knowledge",
          sourceId,
          chunkCount: rows.length,
        },
      });
    },
  )
  .get(
    "/admin/items",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "List knowledge base sources for admin management",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("query", knowledgeListQuerySchema),
    async (c) => {
      const db = c.var.db;
      const query = c.req.valid("query");
      const page = parsePositiveInt(query.page, 1, 100000);
      const pageSize = parsePositiveInt(query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;

      let failedSourceIds: string[] | undefined;
      if (query.failedOnly === "true") {
        const failedRows = await db
          .select({
            ticketId: schema.favoritedConversationsKnowledge.ticketId,
            syncedAt: schema.favoritedConversationsKnowledge.syncedAt,
            updatedAt: schema.favoritedConversationsKnowledge.updatedAt,
            title: schema.tickets.title,
            module: schema.tickets.module,
            category: schema.tickets.category,
          })
          .from(schema.favoritedConversationsKnowledge)
          .leftJoin(
            schema.tickets,
            eq(schema.favoritedConversationsKnowledge.ticketId, schema.tickets.id),
          )
          .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"));
        failedSourceIds = failedRows.map((row) => row.ticketId);
      }

      const whereClause = buildKnowledgeWhere(query, failedSourceIds);
      const statusHaving = buildKnowledgeStatusHaving(query.status ?? "all");
      const disabledChunkCount = sql<number>`COALESCE(SUM(CASE WHEN ${schema.knowledgeBase.isDeleted} THEN 1 ELSE 0 END), 0)`;
      let groups =
        failedSourceIds?.length === 0
          ? []
          : await db
              .select({
                sourceType: schema.knowledgeBase.sourceType,
                sourceId: schema.knowledgeBase.sourceId,
                title: sql<string>`COALESCE(MAX(NULLIF(${schema.knowledgeBase.title}, '')), '')`,
                module: sql<string | null>`MAX(${schema.knowledgeBase.metadata} ->> 'module')`,
                modules: sql<unknown>`(
                  JSONB_AGG(
                    ${schema.knowledgeBase.metadata} -> 'modules'
                    ORDER BY ${schema.knowledgeBase.chunkId}
                  ) FILTER (
                    WHERE ${schema.knowledgeBase.sourceType} = 'general_knowledge'
                      AND JSONB_TYPEOF(${schema.knowledgeBase.metadata} -> 'modules') = 'array'
                  )
                ) -> 0`,
                category: sql<string | null>`MAX(${schema.knowledgeBase.metadata} ->> 'category')`,
                chunkCount: count(),
                disabledChunkCount,
                accessCount: sql<number>`COALESCE(SUM(${schema.knowledgeBase.accessCount}), 0)`,
                isDeleted: sql<boolean>`BOOL_AND(${schema.knowledgeBase.isDeleted})`,
                updatedAt: sql<string>`MAX(${schema.knowledgeBase.updatedAt})`,
              })
              .from(schema.knowledgeBase)
              .where(whereClause)
              .groupBy(schema.knowledgeBase.sourceType, schema.knowledgeBase.sourceId)
              .having(statusHaving)
              .orderBy(sql`MAX(${schema.knowledgeBase.updatedAt}) DESC`);

      if (query.failedOnly === "true") {
        const failedFavorites = await db
          .select({
            ticketId: schema.favoritedConversationsKnowledge.ticketId,
            syncedAt: schema.favoritedConversationsKnowledge.syncedAt,
            updatedAt: schema.favoritedConversationsKnowledge.updatedAt,
            title: schema.tickets.title,
            module: schema.tickets.module,
            category: schema.tickets.category,
          })
          .from(schema.favoritedConversationsKnowledge)
          .leftJoin(
            schema.tickets,
            eq(schema.favoritedConversationsKnowledge.ticketId, schema.tickets.id),
          )
          .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"))
          .orderBy(sql`${schema.favoritedConversationsKnowledge.updatedAt} DESC`);
        const existingFailedSourceIds = new Set(groups.map((row) => row.sourceId));
        const keyword = query.keyword?.trim().toLowerCase();
        const sourceType = query.sourceType ?? "all";
        const module = query.module?.trim();
        const shouldShowZeroChunkFailures =
          (sourceType === "all" || sourceType === "favorited_conversation") &&
          (query.status ?? "all") === "all";
        const zeroChunkFailedGroups = shouldShowZeroChunkFailures
          ? failedFavorites
              .filter((row) => !existingFailedSourceIds.has(row.ticketId))
              .filter((row) => !module || row.module === module)
              .filter((row) => {
                if (!keyword) return true;
                return [
                  row.ticketId,
                  row.title,
                  row.module,
                  row.category,
                ].some((value) => (value ?? "").toLowerCase().includes(keyword));
              })
              .map((row) => ({
                sourceType: "favorited_conversation",
                sourceId: row.ticketId,
                title: row.title ?? row.ticketId,
                module: row.module ?? "",
                modules: null,
                category: row.category ?? "",
                chunkCount: 0,
                disabledChunkCount: 0,
                accessCount: 0,
                isDeleted: false,
                updatedAt: row.updatedAt,
                syncFailed: true,
                syncedAt: row.syncedAt ?? null,
              }))
          : [];
        groups = [...groups, ...zeroChunkFailedGroups].sort((a, b) => {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      }

      const allGroups = await db
        .select({
                sourceType: schema.knowledgeBase.sourceType,
                sourceId: schema.knowledgeBase.sourceId,
                chunkCount: count(),
                disabledChunkCount,
                isDeleted: sql<boolean>`BOOL_AND(${schema.knowledgeBase.isDeleted})`,
              })
              .from(schema.knowledgeBase)
              .groupBy(schema.knowledgeBase.sourceType, schema.knowledgeBase.sourceId);

      const [failedSyncResult] = await db
        .select({ count: count() })
        .from(schema.favoritedConversationsKnowledge)
        .where(eq(schema.favoritedConversationsKnowledge.syncStatus, "failed"));

      const moduleRowsResult = await db.execute(sql`
        SELECT DISTINCT module
        FROM (
          SELECT NULLIF(metadata ->> 'module', '') AS module
          FROM tentix.knowledge_base
          WHERE NULLIF(metadata ->> 'module', '') IS NOT NULL
          UNION
          SELECT NULLIF(jsonb_array_elements_text(metadata -> 'modules'), '') AS module
          FROM tentix.knowledge_base
          WHERE jsonb_typeof(metadata -> 'modules') = 'array'
        ) modules
        WHERE module IS NOT NULL
        ORDER BY module
      `);
      const moduleRows = Array.isArray(moduleRowsResult)
        ? moduleRowsResult
        : moduleRowsResult.rows;

      const pageGroups = groups.slice(offset, offset + pageSize);
      const favoriteSourceIds = pageGroups
        .filter((row) => row.sourceType === "favorited_conversation")
        .map((row) => row.sourceId);
      const favoriteRows = favoriteSourceIds.length
        ? await db.query.favoritedConversationsKnowledge.findMany({
            where: inArray(
              schema.favoritedConversationsKnowledge.ticketId,
              favoriteSourceIds,
            ),
          })
        : [];
      const favoriteByTicketId = new Map(
        favoriteRows.map((row) => [row.ticketId, row]),
      );

      return c.json({
        items: pageGroups.map((row) => {
          const favorite = favoriteByTicketId.get(row.sourceId);
          const storedModules = Array.isArray(row.modules)
            ? row.modules.filter(
                (item): item is string => typeof item === "string",
              )
            : [];
          const modules =
            row.sourceType === "general_knowledge"
              ? normalizeStringList(
                  storedModules.length
                    ? storedModules
                    : row.module
                      ? [row.module]
                      : [],
                )
              : undefined;
          return {
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            title: row.title || row.sourceId,
            module: row.module ?? "",
            modules,
            category: row.category ?? "",
            chunkCount: Number(row.chunkCount || 0),
            disabledChunkCount: Number(row.disabledChunkCount || 0),
            accessCount: Number(row.accessCount || 0),
            isDeleted: Boolean(row.isDeleted),
            updatedAt: row.updatedAt,
            syncFailed: favorite?.syncStatus === "failed",
            syncedAt: favorite?.syncedAt ?? null,
          };
        }),
        pagination: {
          page,
          pageSize,
          total: groups.length,
          totalPages: Math.ceil(groups.length / pageSize),
        },
        summary: {
          enabledCount: allGroups.filter((row) => Number(row.disabledChunkCount || 0) < Number(row.chunkCount || 0)).length,
          disabledCount: allGroups.filter((row) => Number(row.disabledChunkCount || 0) > 0).length,
          chunkCount: allGroups.reduce((sum, row) => sum + Number(row.chunkCount || 0), 0),
          failedSyncCount: Number(failedSyncResult?.count || 0),
        },
        filters: {
          modules: moduleRows.map((row) => String(row.module)).filter(Boolean),
        },
      });
    },
  )
  .get(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Get one knowledge base source with chunks",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      const chunks = await db
        .select({
          id: schema.knowledgeBase.id,
          sourceType: schema.knowledgeBase.sourceType,
          sourceId: schema.knowledgeBase.sourceId,
          chunkId: schema.knowledgeBase.chunkId,
          title: schema.knowledgeBase.title,
          content: schema.knowledgeBase.content,
          metadata: schema.knowledgeBase.metadata,
          score: schema.knowledgeBase.score,
          accessCount: schema.knowledgeBase.accessCount,
          lang: schema.knowledgeBase.lang,
          tokenCount: schema.knowledgeBase.tokenCount,
          isDeleted: schema.knowledgeBase.isDeleted,
          createdAt: schema.knowledgeBase.createdAt,
          updatedAt: schema.knowledgeBase.updatedAt,
        })
        .from(schema.knowledgeBase)
        .where(
          and(
            eq(schema.knowledgeBase.sourceType, sourceType),
            eq(schema.knowledgeBase.sourceId, sourceId),
          ),
        )
        .orderBy(schema.knowledgeBase.chunkId);

      const favorite =
        sourceType === "favorited_conversation"
          ? await db.query.favoritedConversationsKnowledge.findFirst({
              where: eq(schema.favoritedConversationsKnowledge.ticketId, sourceId),
            })
          : null;
      const sourceMessages =
        favorite && favorite.syncStatus === "failed"
          ? await loadFavoritedSourceMessages(db, sourceId, favorite.messageIds)
          : [];
      const ticket =
        sourceType === "favorited_conversation" && favorite
          ? await db.query.tickets.findFirst({
              where: eq(schema.tickets.id, sourceId),
            })
          : null;

      if (chunks.length === 0) {
        if (!favorite || favorite.syncStatus !== "failed") {
          throw new HTTPException(404, { message: "Knowledge item not found" });
        }
        return c.json({
          sourceType,
          sourceId,
          title: ticket?.title || sourceId,
          module: ticket?.module ?? "",
          category: ticket?.category ?? "",
          area: ticket?.area ?? "",
          tags: [],
          problemSummary: "",
          isDeleted: false,
          accessCount: 0,
          syncFailed: true,
          syncedAt: favorite.syncedAt ?? null,
          ticketId: favorite.ticketId,
          selectionMode: getFavoriteSelectionMode(favorite.messageIds),
          sourceMessages,
          createdAt: favorite.createdAt,
          updatedAt: favorite.updatedAt,
          chunks: [],
        });
      }

      const firstChunk = chunks.find((chunk) => Number(chunk.chunkId) === 0) ?? chunks[0]!;
      const module = getMetadataString(firstChunk.metadata, "module");
      const storedModules = getMetadataStringArray(
        firstChunk.metadata,
        "modules",
      );
      const modules =
        sourceType === "general_knowledge"
          ? normalizeStringList(
              storedModules.length
                ? storedModules
                : module
                  ? [module]
                  : [],
            )
          : undefined;

      return c.json({
        sourceType,
        sourceId,
        title: firstChunk.title || sourceId,
        module,
        modules,
        category: getMetadataString(firstChunk.metadata, "category"),
        area: getMetadataString(firstChunk.metadata, "area"),
        tags: getMetadataStringArray(firstChunk.metadata, "tags"),
        problemSummary: getMetadataString(firstChunk.metadata, "problem_summary"),
        isDeleted: chunks.every((chunk) => Boolean(chunk.isDeleted)),
        accessCount: chunks.reduce((sum, chunk) => sum + Number(chunk.accessCount || 0), 0),
        syncFailed: favorite?.syncStatus === "failed",
        syncedAt: favorite?.syncedAt ?? null,
        ticketId: favorite?.ticketId ?? null,
        selectionMode: favorite ? getFavoriteSelectionMode(favorite.messageIds) : null,
        sourceMessages,
        createdAt: firstChunk.createdAt,
        updatedAt: firstChunk.updatedAt,
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          chunkId: Number(chunk.chunkId),
          title: chunk.title,
          content: chunk.content,
          metadata: chunk.metadata,
          score: Number(chunk.score || 0),
          accessCount: Number(chunk.accessCount || 0),
          lang: chunk.lang,
          tokenCount: Number(chunk.tokenCount || 0),
          isDeleted: Boolean(chunk.isDeleted),
          createdAt: chunk.createdAt,
          updatedAt: chunk.updatedAt,
        })),
      });
    },
  )
  .patch(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Update knowledge title, status, chunks, and rebuilt metadata",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    zValidator("json", knowledgeUpdateSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      const payload = c.req.valid("json");
      const existing = await db
        .select()
        .from(schema.knowledgeBase)
        .where(
          and(
            eq(schema.knowledgeBase.sourceType, sourceType),
            eq(schema.knowledgeBase.sourceId, sourceId),
          ),
        )
        .orderBy(schema.knowledgeBase.chunkId);

      if (existing.length === 0) {
        throw new HTTPException(404, { message: "Knowledge item not found" });
      }

      const existingById = new Map(existing.map((row) => [row.id, row]));
      const changedContentById = new Map<string, string>();
      for (const chunk of payload.chunks ?? []) {
        const row = existingById.get(chunk.id);
        if (!row) {
          throw new HTTPException(400, { message: "Invalid knowledge chunk" });
        }
        changedContentById.set(chunk.id, chunk.content);
      }

      const rebuiltById = new Map<string, Awaited<ReturnType<typeof rebuildEditedKnowledgeMetadata>>>();
      const changedEmbeddingById = new Map<string, string>();
      const changedEntries = Array.from(changedContentById.entries());

      if (sourceType === "general_knowledge") {
        if (changedEntries.length === 0) {
          return c.json({ success: true });
        }

        const parentChunk = existing.find((row) => Number(row.chunkId) === 0);
        if (!parentChunk) {
          throw new HTTPException(400, {
            message: "General knowledge content chunk not found",
          });
        }

        const indexRows = existing.filter((row) => Number(row.chunkId) > 0);
        const indexById = new Map(indexRows.map((row) => [row.id, row]));
        for (const [id, content] of changedEntries) {
          const row = indexById.get(id);
          if (!row) {
            throw new HTTPException(400, {
              message: "Only general knowledge recall indexes can be updated",
            });
          }
          if (content.length > 500) {
            throw new HTTPException(400, {
              message: "Recall index content must not exceed 500 characters",
            });
          }
        }

        let changedGeneralKnowledgeIndexes: Array<{
          id: string;
          row: (typeof existing)[number];
          content: string;
          embedding: string;
        }>;
        try {
          changedGeneralKnowledgeIndexes = await mapWithConcurrency(
            changedEntries,
            2,
            async ([id, content]) => {
              const row = indexById.get(id)!;
              const embedding = await embedEditedKnowledgeContent(content);
              return { id, row, content, embedding };
            },
          );
        } catch (err) {
          logWarning(`[kb.admin.rebuildGeneralKnowledgeIndex] failed source=${sourceType}:${sourceId}: ${String(err)}`);
          throw new HTTPException(502, {
            message: "Failed to rebuild general knowledge recall index",
          });
        }

        const generatedIndexes = indexRows
          .slice()
          .sort((a, b) => Number(a.chunkId) - Number(b.chunkId))
          .map((row) => changedContentById.get(row.id) ?? row.content)
          .map((content) => content.trim())
          .filter(Boolean);
        const parentMetadata =
          parentChunk.metadata && typeof parentChunk.metadata === "object"
            ? (parentChunk.metadata as Record<string, unknown>)
            : {};

        await db.transaction(async (tx) => {
          for (const { id, row, content, embedding } of changedGeneralKnowledgeIndexes) {
            await tx
              .update(schema.knowledgeBase)
              .set({
                content,
                embedding: sql`${embedding}::tentix.vector(3072)`,
                contentHash: hashKnowledgeContent({
                  sourceType,
                  sourceId,
                  chunkId: Number(row.chunkId),
                  content,
                }),
                updatedAt: sql`NOW()`,
              })
              .where(eq(schema.knowledgeBase.id, id));
          }

          await tx
            .update(schema.knowledgeBase)
            .set({
              metadata: {
                ...parentMetadata,
                generated_indexes: generatedIndexes,
              },
              updatedAt: sql`NOW()`,
            })
            .where(eq(schema.knowledgeBase.id, parentChunk.id));
        });

        return c.json({ success: true });
      }

      if (changedEntries.length > 0) {
        try {
          const firstChangedRow = existingById.get(changedEntries[0]![0])!;
          const firstMetadata =
            firstChangedRow.metadata && typeof firstChangedRow.metadata === "object"
              ? (firstChangedRow.metadata as Record<string, unknown>)
              : {};
          const sourceContext = await loadEditedKnowledgeSourceContext({
            db,
            sourceType,
            sourceId,
            metadata: firstMetadata,
          });
          const rebuiltChunks = await mapWithConcurrency(
            changedEntries,
            2,
            async ([id, content]) => {
              const row = existingById.get(id)!;
              const metadata =
                row.metadata && typeof row.metadata === "object"
                  ? (row.metadata as Record<string, unknown>)
                  : {};
              const rebuilt = await rebuildEditedKnowledgeMetadata({
                db,
                sourceType,
                sourceId,
                title: row.title || sourceId,
                metadata,
                chunks: [{ chunkId: Number(row.chunkId), content }],
                sourceContext,
              });
              const embedding = await embedEditedKnowledgeContent(content);
              return { id, rebuilt, embedding };
            },
          );
          for (const { id, rebuilt, embedding } of rebuiltChunks) {
            rebuiltById.set(id, rebuilt);
            changedEmbeddingById.set(id, embedding);
          }
        } catch (err) {
          logWarning(`[kb.admin.rebuildChunk] failed source=${sourceType}:${sourceId}: ${String(err)}`);
          throw new HTTPException(502, {
            message: "Failed to rebuild knowledge chunk",
          });
        }
      }

      await db.transaction(async (tx) => {
        for (const [id, content] of changedContentById) {
          const row = existingById.get(id)!;
          const rebuilt = rebuiltById.get(id)!;
          const metadata =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {};
          await tx
            .update(schema.knowledgeBase)
            .set({
              content,
              metadata: {
                ...metadata,
                problem_summary: rebuilt.metadata.problem_summary,
                solution_steps: rebuilt.metadata.solution_steps,
                generated_queries: rebuilt.metadata.generated_queries,
                tags: rebuilt.metadata.tags,
              },
              embedding: sql`${changedEmbeddingById.get(id)}::tentix.vector(3072)`,
              contentHash: hashKnowledgeContent({
                sourceType,
                sourceId,
                chunkId: Number(row.chunkId),
                content,
              }),
              updatedAt: sql`NOW()`,
            })
            .where(eq(schema.knowledgeBase.id, id));
        }
      });

      return c.json({ success: true });
    },
  )
  .patch(
    "/admin/chunks/:id",
    adminOnlyMiddleware(),
    zValidator("param", knowledgeChunkParamsSchema),
    zValidator("json", knowledgeChunkUpdateSchema),
    async (c) => {
      const db = c.var.db;
      const { id } = c.req.valid("param");
      const payload = c.req.valid("json");
      const [updated] = await db
        .update(schema.knowledgeBase)
        .set({
          isDeleted: payload.isDeleted,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.knowledgeBase.id, id))
        .returning({ id: schema.knowledgeBase.id });
      if (!updated) throw new HTTPException(404, { message: "Knowledge chunk not found" });
      return c.json({ success: true });
    },
  )
  .delete(
    "/admin/items/:sourceType/:sourceId",
    adminOnlyMiddleware(),
    describeRoute({
      tags: ["KB"],
      description: "Delete knowledge source and its chunks",
      security: [{ bearerAuth: [] }],
    }),
    zValidator("param", knowledgeSourceParamsSchema),
    async (c) => {
      const db = c.var.db;
      const { sourceType, sourceId } = c.req.valid("param");
      await db.transaction(async (tx) => {
        await tx
          .delete(schema.knowledgeBase)
          .where(
            and(
              eq(schema.knowledgeBase.sourceType, sourceType),
              eq(schema.knowledgeBase.sourceId, sourceId),
            ),
          );

        if (sourceType === "favorited_conversation") {
          await tx
            .delete(schema.favoritedConversationsKnowledge)
            .where(eq(schema.favoritedConversationsKnowledge.ticketId, sourceId));
        }
      });

      return c.json({ success: true });
    },
  );

export { kbRouter };
