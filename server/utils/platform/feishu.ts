import { logError } from "../log.ts";
import { isFeishuConfigured } from "@/utils/tools";
import { FeishuDepartmentsInfo } from "./feishu.type.ts";

type cardType = {
  msg_type: "interactive";
  card: {
    type: "template";
    data: {
      template_id: string;
      template_version_name: string;
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
        template_id: "AAq4SPHXffwrs",
        template_version_name: "1.0.5",
      },
    },
  },
  transfer: {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: "AAq4v8XPOZOiI",
        template_version_name: "1.0.4",
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
): Promise<never> {
  let errorDetails: unknown;
  try {
    errorDetails = await res.json();
  } catch {
    errorDetails = { status: res.status, statusText: res.statusText };
  }

  logError(`Attempt ${attemptNumber}/${maxRetries + 1} failed:`, errorDetails);
  throw new Error(`HTTP ${res.status}: ${res.statusText}`, {
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
          await handleFetchError(res, attempt + 1, config.maxRetries);
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
          `Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${config.maxRetries})`,
        );
        await delay(delayMs);
      }
    }

    throw lastError || new Error("Failed to fetch after all retries");
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
