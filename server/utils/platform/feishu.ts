import { readConfig } from "../env.ts";
import { logError } from "../log.ts";
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
  console.log("accessToken", accessToken);
  const requestBody = {
    receive_id: receiveId,
    msg_type: msgType,
    content,
  };
  console.log("Sending Feishu message with body:", JSON.stringify(requestBody, null, 2));
  
  const res = await myFetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
    },
  );
  console.log("send feishu msg res", res);
  if (!res.ok) {
    let errorDetails;
    try {
      errorDetails = await res.json();
    } catch {
      errorDetails = { status: res.status, statusText: res.statusText };
    }
    console.log("Feishu message send error details:", errorDetails);
    throw new Error(`Failed to send Feishu message. Status: ${res.status}`, {
      cause: errorDetails
    });
  }
  return res.json();
}

const proxyHandler = {
  async apply(
    target: typeof fetch,
    _this: unknown,
    argumentsList: Parameters<typeof fetch>,
  ) {
    const MAX_RETRIES = 1;
    const TIMEOUT_MS = 10000; // 10 seconds timeout for Feishu API
    const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const [url, options = {}] = argumentsList;
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };

        const res = await target(url, fetchOptions);
        clearTimeout(timeoutId);

        if (!res.ok) {
          let cause: any;
          try {
            cause = await res.json();
          } catch (jsonError) {
            cause = { status: res.status, statusText: res.statusText };
          }
          logError(`Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, cause);
          throw new Error(`Failed to fetch. Status: ${res.status}`, {
            cause: cause.error_description ?? cause,
          });
        }
        return res;
      } catch (error) {
        lastError = error as Error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timeout", { cause: error });
        }
        if (attempt === MAX_RETRIES) {
          break;
        }
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        logError(
          `Retrying in ${delay}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
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

  const config = await readConfig();
  console.log("send feishu app access token");
  console.log(config);
  const res = await myFetch(
    "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: config.feishu_app_id,
        app_secret: config.feishu_app_secret,
      }),
    },
  );
  console.log(res);
  const data: {
    app_access_token: `t-${string}` | `a-${string}`;
    code: number;
    expire: number;
    msg: string;
    tenant_access_token: `t-${string}`;
  } = await res.json();
  console.log(data);
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
  const allItems: any[] = [];

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
