"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { AppPageHeading } from "@/components/app/app-page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";
import { contactViewContext, contactsViewContext } from "@/lib/patchsmith";
import { useViewContext } from "@/lib/patchsmith-client";

export default function LoadingContact() {
  const { id } = useParams<{ id: string }>();
  // Observe the workspace cache without waiting for the destination page or
  // starting another request. The workspace-keyed QueryProvider isolates it.
  const { data: workspace } = useQuery({
    ...orpc.workspace.snapshot.queryOptions(),
    enabled: false,
  });
  const contact = workspace?.contacts.find((item) => item.id === id);

  // The loading boundary owns these registrations only until ContactDetail
  // mounts with the refreshed data and its interactive tab state.
  useViewContext("/contacts", {
    context: workspace ? contactsViewContext(workspace) : undefined,
    loading: !workspace,
  });
  useViewContext("/contacts/detail", {
    context: workspace && contact ? contactViewContext(workspace, contact, "activity") : undefined,
    loading: !contact,
  });

  return (
    <>
      <AppPageHeading>
        {contact ? (
          <h1 className="text-xl font-semibold tracking-tight">{contact.name}</h1>
        ) : (
          <Skeleton className="h-7 w-48" />
        )}
      </AppPageHeading>
      <div className="flex flex-col gap-6" aria-label="Loading contact">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  );
}
