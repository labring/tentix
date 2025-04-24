import type { AppType } from "@server/api";
import { type ClientRequestOptions, hc } from "hono/client";
import ky from "ky";

const baseUrl = import.meta.env.DEV
  ? "http://localhost:3000"
  : import.meta.env.BASE_URL;

export const fetch = ky.extend({
  hooks: {
    afterResponse: [
      async (_, __, response: Response) => {
        if (response.ok) {
          return response;
        }
        throw await response.json();
      },
    ],
  },
});

// this is a trick to calculate the type when compiling
const api = hc<AppType>("");

const initClient = (args?: ClientRequestOptions): typeof api =>
  hc<AppType>(baseUrl, args);

export const apiClient = initClient({
  fetch: fetch,
}).api;
