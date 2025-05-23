import { initClient } from "@server/utils/rpc";
import ky from "ky";

// const baseUrl = import.meta.env.DEV
//   ? "http://localhost:3000"
//   : import.meta.env.BASE_URL;

export const fetch = ky.extend({
  headers: {
    Authorization: `Bearer ${window.localStorage.getItem("token")}`,
  },
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
  retry: 1,
  throwHttpErrors: true,
});

export const apiClient = initClient(import.meta.env.BASE_URL, {
  fetch: fetch,
});
