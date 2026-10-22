import { defaultShouldDehydrateQuery, MutationCache, QueryClient } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { patchsmithQueryKey } from "./patchsmith-queries";

export function makeQueryClient() {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Every CRM mutation can affect counts, linked records and activity.
      // Wait for CRM data, while app discovery refreshes in the background.
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: patchsmithQueryKey });
        return queryClient.invalidateQueries({ queryKey: orpc.key() });
      },
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
