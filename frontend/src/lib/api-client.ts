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
      async (_, __, response: Response) => {
        if (response.ok) {
          return response;
        }
        if (response.status === 401) {
          window.localStorage.removeItem("sealosToken");
          window.localStorage.removeItem("sealosArea");
          window.localStorage.removeItem("sealosNs");
          window.localStorage.removeItem("token");
          window.localStorage.removeItem("role");
          window.localStorage.removeItem("id");
          window.localStorage.removeItem("user");
          window.location.href = "/";
        }
        throw await response.json();
      },
    ],
  },
  retry: 1,
  throwHttpErrors: true,
});

export const apiClient = initClient(import.meta.env.BASE_URL, {
  fetch: myFetch,
});
