"use client";

import { RenderSlot, useViews, useViewContext } from "@/lib/patchsmith-client";
import { redirect } from "next/navigation";
import { appPageHref, appPageLabel, findAppPage, type AppPageTarget } from "@/lib/app-pages";
import { AppLogo } from "./app-logo";
import { AppPageHeading } from "./app-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function AppPage({ target }: { target: AppPageTarget }) {
  const { data: pages, isPending, error, fetch } = useViews({ slot: "page" });
  const page = pages ? findAppPage(pages, target) : undefined;
  useViewContext("/app-pages", {
    context: {
      appPage: {
        appId: page?.app.id ?? ("appId" in target ? target.appId : ""),
        instanceKey: page?.key ?? ("instanceKey" in target ? target.instanceKey : ""),
      },
    },
  });

  if (page && !isPending && !error && "appId" in target) redirect(appPageHref(page, pages));

  return (
    <>
      <AppPageHeading>
        <div className="flex min-w-0 items-center gap-2">
          {page ? <AppLogo app={page.app} /> : null}
          <h1 className="truncate text-sm font-medium">{page ? appPageLabel(page) : "App page"}</h1>
        </div>
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
          <RenderSlot
            key={appPageHref(page, pages)}
            app={page.app}
            slot="page"
            instanceKey={page.key}
          />
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
