import { defaultShouldDehydrateQuery, MutationCache, QueryClient } from "@tanstack/react-query";
import { orpc } from "./orpc";

export function makeQueryClient() {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Every CRM mutation can affect counts, linked records and activity.
      // Await the refetch so mutation pending state covers the visible update.
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.key() }),
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
    },
  });
  return queryClient;
}
