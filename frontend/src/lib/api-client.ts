import { initClient } from "tentix-server/rpc";
import ky from "ky";

// const baseUrl = import.meta.env.DEV
//   ? "http://localhost:3000"
//   : import.meta.env.BASE_URL;

export const myFetch = ky.extend({
  hooks: {
    beforeRequest: [
      (request) => {
        // dynamic get token, ensure the latest token is used for each request
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
        const message =
          (data &&
            (String((data as any).message || (data as any).error || (data as any).msg))) ||
          response.statusText;
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

export const apiClient = initClient(import.meta.env.BASE_URL, {
  fetch: myFetch,
});
