import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import ErrorPrint from "@comp/core/error-print";
import NotFound from "@comp/core/not-found";
import { routeTree } from "./routeTree.gen";
import { getQueryClient } from "./_provider/tanstack";
import { apiClient } from "./lib";


export const router = createTanStackRouter({
  routeTree,
  defaultPreload: "intent",
  context: { queryClient: getQueryClient(), apiClient },
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: ErrorPrint,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
