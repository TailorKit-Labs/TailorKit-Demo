import { AppPage } from "@/components/app/app-page";
import { getTenant } from "@/lib/workspace-session";

export const metadata = { title: "App page" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<{ instance?: string | string[] }>;
}) {
  if (!(await getTenant())) return null;
  const [{ appId }, { instance }] = await Promise.all([params, searchParams]);
  return <AppPage appId={appId} instanceKey={typeof instance === "string" ? instance : ""} />;
}
