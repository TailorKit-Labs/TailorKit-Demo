import { AppPage } from "@/components/app/app-page";
import { getTenant } from "@/lib/workspace-session";
import { HydrateClient } from "@/lib/query.server";
import { prefetchViews } from "@/lib/patchsmith-queries.server";

export const metadata = { title: "App page" };

export default async function Page({
  params,
}: {
  params: Promise<{ appSlug: string; instance: string }>;
}) {
  const [tenant, target] = await Promise.all([getTenant(), params]);
  if (!tenant) return null;
  void prefetchViews(
    tenant,
    "page",
    `/apps/${encodeURIComponent(target.appSlug)}/${encodeURIComponent(target.instance)}`,
  );
  return (
    <HydrateClient>
      <AppPage target={target} workspace={{ id: tenant.id, name: tenant.name }} />
    </HydrateClient>
  );
}
