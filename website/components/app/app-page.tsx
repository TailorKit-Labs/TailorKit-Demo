"use client";

import { RenderSlot, useViews, useViewContext } from "@/lib/patchsmith-client";
import { appPageHref, appPageLabel } from "@/lib/app-pages";
import { AppPageHeading } from "./app-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function AppPage({ appId, instanceKey }: { appId: string; instanceKey: string }) {
  useViewContext("/app-pages", { context: { appPage: { appId, instanceKey } } });
  const { data: pages, isPending, error, fetch } = useViews({ slot: "page" });
  const page = pages?.find((page) => page.app.id === appId && page.key === instanceKey);

  return (
    <>
      <AppPageHeading>
        <h1 className="truncate text-sm font-medium">{page ? appPageLabel(page) : "App page"}</h1>
      </AppPageHeading>
      {isPending ? (
        <Skeleton className="h-64 w-full" aria-label="Loading app page" />
      ) : error ? (
        <Alert variant="error">
          <AlertTitle>Could not load app pages</AlertTitle>
          <AlertDescription>
            <p>Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => void fetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : page ? (
        <div className="min-h-0 flex-1 [&>[data-patchsmith-view]]:h-full [&_canvas]:!h-full [&_canvas]:max-h-full [&_canvas]:!w-full [&_canvas]:max-w-full [&_canvas]:aspect-[4/3] [&_canvas]:object-contain [&_canvas]:[image-rendering:pixelated]">
          <RenderSlot key={appPageHref(page)} app={page.app} slot="page" instanceKey={page.key} />
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Page unavailable</EmptyTitle>
            <EmptyDescription>
              This app page is no longer available in this workspace.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
