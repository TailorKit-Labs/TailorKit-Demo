import { AppPage } from "@/components/app/app-page";
import { getTenant } from "@/lib/workspace-session";

export const metadata = { title: "App page" };

export default async function Page({
  params,
}: {
  params: Promise<{ appSlug: string; instance: string }>;
}) {
  if (!(await getTenant())) return null;
  return <AppPage target={await params} />;
}
