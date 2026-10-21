"use client";

import { RenderSlot, useViews, useViewContext } from "@/lib/patchsmith-client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { appPageHref, appPageLabel, findAppPage, type AppPageTarget } from "@/lib/app-pages";
import { AppLogo } from "./app-logo";
import { AppPageHeading } from "./app-page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function AppPage({
  target,
  workspace,
}: {
  target: AppPageTarget;
  workspace: { id: string; name: string };
}) {
  const pathname = usePathname();
  const { data: pages, isPending, error, fetch } = useViews({ slot: "page" });
  const page = pages ? findAppPage(pages, target) : undefined;
  const [identity, setIdentity] = useState({
    appId: "",
    instanceKey: "",
  });
  useEffect(() => {
    if (!page) return;
    setIdentity((previous) =>
      previous.appId === page.app.id && previous.instanceKey === page.key
        ? previous
        : { appId: page.app.id, instanceKey: page.key },
    );
  }, [page]);
  // Discovery refetches when context changes. Keep the resolved identity while
  // that query reloads, rather than alternating between an ID and an empty ID.
  useViewContext("/app-pages", {
    context: { appPage: identity },
  });

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
        <div
          data-demo="app-page-surface"
          className="min-h-0 flex-1 [&>[data-patchsmith-view]]:h-full [&_canvas]:!h-full [&_canvas]:max-h-full [&_canvas]:!w-full [&_canvas]:max-w-full [&_canvas]:aspect-[4/3] [&_canvas]:object-contain [&_canvas]:[image-rendering:pixelated]"
        >
          <RenderSlot.Controlled
            key={appPageHref(page, pages)}
            app={page.app}
            slot="page"
            view="/"
            status="ready"
            context={{ workspace, page: pathname }}
            instance={{ key: page.key, data: page.data, metadata: page.metadata }}
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
