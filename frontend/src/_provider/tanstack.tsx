import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { PropsWithChildren } from "react";
import { toast } from "tentix-ui";

function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        console.error(error);
        toast({
          title: `Error!`,
          description: error.message,
          type: "foreground",
        });
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error(error, query.queryKey);
        toast({
          title: `Error when ${query.queryKey.join(".")}`,
          description: error.message,
          type: "foreground",
        });
        // TODO: Observability intergrate
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export default function AppTanstackProvider({ children }: PropsWithChildren) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools buttonPosition="top-right" />
    </QueryClientProvider>
  );
}
