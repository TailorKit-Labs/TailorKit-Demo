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
          <p role="status" className="p-6 text-sm text-muted-foreground">
            Loading workspace…
          </p>
        }
      >
        {children}
      </Suspense>
    </QueryClientProvider>
  );
}
