import { notFound } from "next/navigation";
import { ORPCError } from "@orpc/client";
import { getTenant } from "@/lib/workspace-session";
import { orpc } from "@/lib/orpc.server";
import { HydrateClient, getQueryClient, prefetch } from "@/lib/query.server";
import { CrmPages } from "@/components/crm-pages";
import { prefetchViews } from "@/lib/patchsmith-queries.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [tenant, { id }] = await Promise.all([getTenant(), params]);
  if (!tenant) return null;
  void prefetch(orpc.workspace.snapshot.queryOptions());
  void prefetchViews(tenant, "page", `/contacts/${encodeURIComponent(id)}`);
  try {
    await getQueryClient().fetchQuery(orpc.contacts.get.queryOptions({ input: { id } }));
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  return (
    <HydrateClient>
      <CrmPages view="contacts" contactId={id} />
    </HydrateClient>
  );
}
