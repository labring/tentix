import type { QueryClient } from "@tanstack/react-query";
import {
  createRouter as createTanStackRouter
} from "@tanstack/react-router";
import { type AuthContext } from "./_provider/auth";
import { apiClient } from "./lib";
import { routeTree } from "./routeTree.gen";
import { getQueryClient } from "./_provider/tanstack";


export type RouterContext = {
  queryClient: QueryClient;
  apiClient: typeof apiClient;
  authContext: AuthContext;
};

export const router = createTanStackRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    queryClient: getQueryClient(),
    apiClient,
    authContext: undefined!
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
