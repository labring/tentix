import { initClient } from "tentix-server/rpc";
import ky from "ky";
import i18nBase from "i18n";
import { waitForSealosAuthReady } from "../_provider/sealos";
import { getRequestLanguage } from "./language";

// const baseUrl = import.meta.env.DEV
//   ? "http://localhost:3000"
//   : import.meta.env.BASE_URL;

export const myFetch = ky.extend({
  hooks: {
    beforeRequest: [
      async (request) => {
        await waitForSealosAuthReady(request.url);
        // dynamic get token, ensure the latest token is used for each request
        request.headers.set("Accept-Language", getRequestLanguage());
        const token = window.localStorage.getItem("token");
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, __, response: Response) => {
        if (response.ok) {
          return response;
        }

        if (response.status === 401) {
          const url = request?.url || "";
          const isAuthEndpoint =
            url.includes("/auth/login") || url.includes("/auth/register");

          // Avoid redirecting on login/register so the page can show proper toasts
          if (!isAuthEndpoint) {
            window.localStorage.removeItem("sealosToken");
            window.localStorage.removeItem("sealosArea");
            window.localStorage.removeItem("sealosNs");
            window.localStorage.removeItem("token");
            window.localStorage.removeItem("role");
            window.localStorage.removeItem("id");
            window.localStorage.removeItem("user");
            window.location.href = "/";
          }
        }

        // Prefer backend message over statusText; parse JSON -> text -> fallback
        const parseError = async () => {
          try {
            return await response.clone().json();
          } catch {
            try {
              const text = await response.clone().text();
              if (!text) return {};
              try {
                return JSON.parse(text);
              } catch {
                return { message: text };
              }
            } catch {
              return {};
            }
          }
        };
        const data = (await parseError()) as Record<string, unknown> | undefined;
        // Only text is displayable; a non-text payload (e.g. a validation error
        // object) must fall back to a readable, localized message.
        const asText = (value: unknown) =>
          typeof value === "string" && value.trim() ? value : undefined;
        const serverText =
          asText(data?.message) ?? asText(data?.error) ?? asText(data?.msg);
        const hasErrorDetail = [data?.message, data?.error, data?.msg].some(
          (value) => value !== undefined && value !== null,
        );
        const message =
          serverText ??
          (hasErrorDetail || !response.statusText
            ? i18nBase.t("request_failed")
            : response.statusText);
        throw {
          code: response.status,
          message,
          ...(data || {}),
        } as any;
      },
    ],
  },
  retry: 1,
  throwHttpErrors: true,
});

const KB_ADMIN_SAVE_TIMEOUT_MS = 60_000;
const KB_INDEX_GENERATE_TIMEOUT_MS = 60_000;
const KB_FILE_PREVIEW_TIMEOUT_MS = 60_000;
const HOT_ISSUES_ANALYTICS_TIMEOUT_MS = 90_000;

export const kbAdminSaveFetch = myFetch.extend({
  timeout: KB_ADMIN_SAVE_TIMEOUT_MS,
});

export const kbIndexGenerateFetch = myFetch.extend({
  timeout: KB_INDEX_GENERATE_TIMEOUT_MS,
});

export const kbFilePreviewFetch = myFetch.extend({
  timeout: KB_FILE_PREVIEW_TIMEOUT_MS,
});

export const hotIssuesAnalyticsFetch = myFetch.extend({
  timeout: HOT_ISSUES_ANALYTICS_TIMEOUT_MS,
});

export const apiClient = initClient(import.meta.env.BASE_URL, {
  fetch: myFetch,
});
