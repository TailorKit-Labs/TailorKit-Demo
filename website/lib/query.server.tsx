import { cache, type ReactNode } from "react";
import {
  dehydrate,
  HydrationBoundary,
  type FetchQueryOptions,
  type FetchInfiniteQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { makeQueryClient } from "./query-client";

// Shared by layouts/pages in one RSC request, never between users.
export const getQueryClient = cache(makeQueryClient);

export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}

export function prefetch<T, E = Error, K extends QueryKey = QueryKey>(
  options: FetchQueryOptions<T, E, T, K>,
) {
  return getQueryClient().prefetchQuery(options);
}

// Preserve the page parameter types from oRPC's .infiniteOptions.
export function prefetchInfinite<T, E = Error, K extends QueryKey = QueryKey, P = unknown>(
  options: FetchInfiniteQueryOptions<T, E, T, K, P>,
) {
  return getQueryClient().prefetchInfiniteQuery(options);
}
