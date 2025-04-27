import { initClient } from "@server/utils/rpc";
import ky from "ky";

// const baseUrl = import.meta.env.DEV
//   ? "http://localhost:3000"
//   : import.meta.env.BASE_URL;

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



export const apiClient = initClient(import.meta.env.BASE_URL, {
  fetch: fetch,
});
