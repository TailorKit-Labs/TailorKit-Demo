"use client";

import { Suspense, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "./query-client";

// The layout keys this provider by workspace, so changing sessions discards the
// previous workspace's browser cache. The boundary keeps it stable on suspense.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={
          <div role="status" className="flex h-dvh overflow-hidden bg-sidebar">
            <span className="sr-only">Loading workspace…</span>
            <div aria-hidden="true" className="hidden w-[17rem] shrink-0 min-[800px]:block" />
            <div aria-hidden="true" className="flex min-w-0 flex-1 max-[799px]:pt-14 md:p-2">
              <div className="min-w-0 flex-1 bg-background md:rounded-2xl md:border md:shadow-xs" />
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </QueryClientProvider>
  );
}
