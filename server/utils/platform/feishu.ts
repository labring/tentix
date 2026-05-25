import { createHmac } from "node:crypto";
import { logError } from "../log.ts";
import { isFeishuConfigured } from "@/utils/tools";
import { FeishuDepartmentsInfo } from "./feishu.type.ts";

type cardType = {
  msg_type: "interactive";
  card: {
    type: "template";
    data: {
      template_id: string;
      template_version_name?: string;
      template_variable?: Record<string, unknown>;
    };
  };
};

type cardName = "new_ticket" | "transfer";

const cardMap: Record<cardName, cardType> = {
  new_ticket: {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: global.customEnv.FEISHU_NEW_TICKET_CARD!,
      },
    },
  },
  transfer: {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: global.customEnv.FEISHU_TRANSFER_CARD!,
      },
    },
  },
};

type FeiShuTheme =
  | "blue"
  | "wathet"
  | "turquoise"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "carmine"
  | "violet"
  | "purple"
  | "indigo"
  | "grey"
  | "default";

type Card1Variable = {
  title: string;
  description: string;
  time: string;
  module: string;
  assignee: string;
  number: number;
  area: string;
  theme: FeiShuTheme;
  internal_url: {
    url: string;
  };
  ticket_url: {
    url: string;
  };
};

type Card2Variable = {
  title: string;
  comment: string;
  module: string;
  assignee: string;
  transfer_to: string;
  area: string;
  internal_url: {
    url: string;
  };
  ticket_url: {
    url: string;
  };
};

export const getFeishuCard: (
  cardType: cardName,
  variable: Card1Variable | Card2Variable,
) => cardType = function (cardType, variable) {
  return Object.assign(cardMap[cardType], {
    card: {
      ...cardMap[cardType].card,
      data: {
        ...cardMap[cardType].card.data,
        template_variable: variable,
      },
    },
  }) satisfies cardType;
};

export async function sendFeishuMsg(
  receiveIdType: "chat_id" | "user_id" | "email" | "open_id",
  receiveId: string,
  msgType:
    | "text"
    | "post"
    | "image"
    | "file"
    | "audio"
    | "media"
    | "sticker"
    | "interactive",
  content: string,
  accessToken: `t-${string}`,
) {
  const res = await myFetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: msgType,
        content,
      }),
    },
  );
  if (!res.ok) {
    throw new Error("Failed to send Feishu message");
  }
  return res.json();
}

export type FeishuComplaintWebhookPayload = {
  kind: "message" | "staff" | "ticket";
  ticketId: string;
  ticketTitle: string;
  sealosId?: string;
  messageId?: number;
  targetName?: string;
  satisfactionRating?: number;
  dislikeReasons?: unknown[] | null;
  feedbackComment?: string | null;
  hasComplaint?: boolean | null;
};

type FeishuComplaintWebhookResponse = {
  code?: number;
  msg?: string;
  StatusCode?: number;
  StatusMessage?: string;
};

function getFeishuComplaintWebhookSign(timestamp: string, secret: string) {
  return createHmac("sha256", `${timestamp}\n${secret}`)
    .update("")
    .digest("base64");
}

function getComplaintKindText(kind: FeishuComplaintWebhookPayload["kind"]) {
  switch (kind) {
    case "message":
      return "消息评价";
    case "staff":
      return "人员评价";
    case "ticket":
      return "工单满意度";
  }
}

const complaintReasonTextMap: Record<string, string> = {
  irrelevant: "不相关",
  unresolved: "未解决",
  unfriendly: "不友好",
  slow_response: "响应慢",
  other: "其他",
};

function getComplaintReasonText(reason: unknown) {
  const key = String(reason);
  return complaintReasonTextMap[key] || key;
}

function getComplaintCardTheme(payload: FeishuComplaintWebhookPayload) {
  if (
    payload.hasComplaint ||
    (payload.kind === "ticket" &&
      payload.satisfactionRating !== undefined &&
      payload.satisfactionRating <= 2)
  ) {
    return "red" satisfies FeiShuTheme;
  }

  return "orange" satisfies FeiShuTheme;
}

function buildFeishuComplaintWebhookCard(payload: FeishuComplaintWebhookPayload) {
  const appUrl = global.customEnv.APP_URL?.replace(/\/$/, "");
  const ticketUrl = appUrl ? `${appUrl}/staff/tickets/${payload.ticketId}` : "";
  const fields = [
    {
      label: "类型",
      value: getComplaintKindText(payload.kind),
    },
    {
      label: "工单标题",
      value: payload.ticketTitle,
    },
    {
      label: "工单ID",
      value: payload.ticketId,
    },
  ];

  if (payload.sealosId) {
    fields.push({
      label: "Sealos ID",
      value: payload.sealosId,
    });
  }

  if (payload.messageId !== undefined) {
    fields.push({
      label: "消息ID",
      value: String(payload.messageId),
    });
  }

  if (payload.targetName) {
    fields.push({
      label: "评价对象",
      value: payload.targetName,
    });
  }

  if (payload.satisfactionRating !== undefined) {
    fields.push({
      label: "满意度",
      value: `${payload.satisfactionRating}星`,
    });
  }

  if (payload.dislikeReasons?.length) {
    fields.push({
      label: "原因",
      value: payload.dislikeReasons.map(getComplaintReasonText).join(", "),
    });
  }

  if (payload.hasComplaint) {
    fields.push({
      label: "用户操作",
      value: "勾选投诉",
    });
  }

  const comment = payload.feedbackComment?.trim();
  if (comment) {
    fields.push({
      label: "反馈内容",
      value: comment,
    });
  }

  const elements: Record<string, unknown>[] = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: fields
          .map((field) => `**${field.label}：**${field.value}`)
          .join("\n"),
      },
    },
  ];

  if (ticketUrl) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: {
            tag: "plain_text",
            content: "查看工单",
          },
          type: "primary",
          url: ticketUrl,
        },
      ],
    });
  }

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: getComplaintCardTheme(payload),
      title: {
        tag: "plain_text",
        content: "投诉通知",
      },
    },
    elements,
  };
}

export async function sendFeishuComplaintWebhook(
  payload: FeishuComplaintWebhookPayload,
) {
  const webhookUrl = global.customEnv.FEISHU_COMPLAINT_WEBHOOK_URL?.trim();
  const secret = global.customEnv.FEISHU_COMPLAINT_WEBHOOK_SECRET?.trim();
  if (!webhookUrl || !secret) {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = getFeishuComplaintWebhookSign(timestamp, secret);
  const res = await myFetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timestamp,
      sign,
      msg_type: "interactive",
      card: buildFeishuComplaintWebhookCard(payload),
    }),
  });

  const data = (await res.json().catch(
    () => null,
  )) as FeishuComplaintWebhookResponse | null;
  if (
    data &&
    ((typeof data.code === "number" && data.code !== 0) ||
      (typeof data.StatusCode === "number" && data.StatusCode !== 0))
  ) {
    throw new Error(data.msg || data.StatusMessage || "Feishu webhook failed");
  }
}

interface RetryConfig {
  maxRetries: number;
  timeoutMs: number;
  initialDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 1,
  timeoutMs: 3000, // 3 seconds timeout for Feishu API
  initialDelayMs: 1000, // 1 second initial delay
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller?: AbortController,
): Promise<T> {
  const timeoutId = setTimeout(() => {
    // If we have a controller, abort it to trigger timeout
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }, timeoutMs);

  try {
    return await promise;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleFetchError(
  res: Response,
  attemptNumber: number,
  maxRetries: number,
  url?: string,
): Promise<never> {
  let errorDetails: unknown;
  let errorMessage = "";
  
  try {
    errorDetails = await res.json();
    // 尝试从响应中提取错误信息
    if (typeof errorDetails === 'object' && errorDetails !== null) {
      const details = errorDetails as Record<string, unknown>;
      errorMessage = (details.msg || details.message || details.error || 
                     `HTTP ${res.status}: ${res.statusText}`) as string;
    } else {
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
  } catch {
    errorDetails = { status: res.status, statusText: res.statusText };
    errorMessage = `HTTP ${res.status}: ${res.statusText}`;
  }

  // 格式化错误详情以便更好地显示
  const formattedDetails = JSON.stringify(errorDetails, null, 2);
  const urlInfo = url ? ` (URL: ${url})` : "";
  
  logError(`🚨 Feishu API 请求失败 - 第 ${attemptNumber}/${maxRetries + 1} 次尝试失败${urlInfo}:`);
  logError(`错误信息: ${errorMessage}`);
  logError(`响应详情: ${formattedDetails}`);
  
  throw new Error(`Feishu API 请求失败: ${errorMessage}`, {
    cause: errorDetails,
  });
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const proxyHandler: ProxyHandler<typeof fetch> = {
  async apply(target, _thisArg, argumentsList) {
    const config = DEFAULT_RETRY_CONFIG;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const [url, options = {}] = argumentsList;

        // Don't override existing signal if provided
        const controller = new AbortController();
        const fetchOptions: RequestInit = {
          ...options,
          signal: options.signal || controller.signal,
        };

        const fetchPromise = target(url, fetchOptions);
        const res = await withTimeout(
          fetchPromise,
          config.timeoutMs,
          controller,
        );

        if (!res.ok) {
          await handleFetchError(res, attempt + 1, config.maxRetries, url);
        }

        return res;
      } catch (error) {
        const err = error as Error;
        lastError = err;

        // Don't retry on timeout or if this is the last attempt
        if (err.name === "AbortError" || attempt === config.maxRetries) {
          if (err.name === "AbortError") {
            throw new Error("Request timeout", { cause: err });
          }
          break;
        }

        // Exponential backoff for retries
        const delayMs = config.initialDelayMs * Math.pow(2, attempt);
        logError(
          `⏳ ${delayMs}ms 后进行第 ${attempt + 2}/${config.maxRetries + 1} 次重试...`,
        );
        await delay(delayMs);
      }
    }

    const finalError = lastError || new Error("请求失败：所有重试尝试都已用尽");
    logError(`💥 Feishu API 请求最终失败: ${finalError.message}`);
    throw finalError;
  },
};

export const myFetch = new Proxy(fetch, proxyHandler);

interface TokenCache {
  app_access_token: `t-${string}` | `a-${string}`;
  tenant_access_token: `t-${string}`;
  expireTime: number;
}

let tokenCache: TokenCache | null = null;

export async function getFeishuAppAccessToken() {
  const now = Date.now();

  // If we have a cached token that isn't expired yet (with 5 minutes buffer)
  if (tokenCache && tokenCache.expireTime > now + 5 * 60 * 1000) {
    return {
      app_access_token: tokenCache.app_access_token,
      tenant_access_token: tokenCache.tenant_access_token,
    };
  }

  if (!isFeishuConfigured()) {
    throw new Error("Feishu is not configured");
  }
  const res = await myFetch(
    "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: global.customEnv.FEISHU_APP_ID!,
        app_secret: global.customEnv.FEISHU_APP_SECRET!,
      }),
    },
  );
  const data: {
    app_access_token: `t-${string}` | `a-${string}`;
    code: number;
    expire: number;
    msg: string;
    tenant_access_token: `t-${string}`;
  } = await res.json();
  if (data.app_access_token && data.expire) {
    tokenCache = {
      app_access_token: data.app_access_token,
      tenant_access_token: data.tenant_access_token,
      expireTime: now + data.expire * 1000, // convert seconds to milliseconds
    };
  }

  return {
    app_access_token: data.app_access_token,
    tenant_access_token: data.tenant_access_token,
  };
}

export async function getFeishuUserInfo(userAccessToken: string): Promise<{
  code: number;
  msg: string;
  data: {
    avatar_big: string;
    avatar_middle: string;
    avatar_thumb: string;
    avatar_url: string;
    en_name: string;
    name: string;
    open_id: `ou_${string}`;
    tenant_key: string;
    union_id: `on_${string}`;
    user_id: string;
  };
}> {
  const res = await myFetch(
    "https://open.feishu.cn/open-apis/authen/v1/user_info",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${userAccessToken}` },
    },
  );
  return res.json();
}

export async function getFeishuUserInfoByDepartment(
  departmentId: string,
  accessToken: `u-${string}` | `t-${string}`,
  userIdType: "union_id" | "open_id" | "user_id" = "union_id",
): Promise<{
  code: number;
  msg: string;
  data: {
    has_more: boolean;
    pageToken?: string;
    items: {
      avatar: {
        avatar_240: string;
        avatar_640: string;
        avatar_72: string;
        avatar_origin: string;
      };
      description: string;
      en_name: string;
      mobile_visible: boolean;
      name: string;
      nickname?: string;
      open_id: string;
      union_id: string;
      user_id: string;
    }[];
  };
}> {
  const allItems: unknown[] = [];

  async function fetchPage(pageToken?: string) {
    const url = new URL(
      `https://open.feishu.cn/open-apis/contact/v3/users/find_by_department?department_id_type=open_department_id&pageSize=50`,
    );
    url.searchParams.append("user_id_type", userIdType);
    url.searchParams.append("department_id", departmentId);
    if (pageToken) {
      url.searchParams.append("pageToken", pageToken);
    }

    const res = await myFetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (data.data.items) {
      allItems.push(...data.data.items);
    }

    if (data.data.has_more && data.data.pageToken) {
      await fetchPage(data.data.pageToken);
    }

    return data;
  }
  const result = await fetchPage();
  return {
    ...result,
    data: {
      ...result.data,
      items: allItems,
    },
  };
}

export async function getFeishuDepartmentsInfo(
  departmentIds: string | string[],
  accessToken: `u-${string}` | `t-${string}`,
): Promise<FeishuDepartmentsInfo> {
  const url = new URL(
    `https://open.feishu.cn/open-apis/contact/v3/departments/batch`,
  );
  if (Array.isArray(departmentIds)) {
    departmentIds.forEach((id) =>
      url.searchParams.append("department_ids", id),
    );
  } else {
    url.searchParams.append("department_ids", departmentIds);
  }
  const res = await myFetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}
