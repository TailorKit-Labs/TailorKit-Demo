import { AppPageHeading } from "@/components/app/app-page-header";

// App pages provide their own loading UI; keep the CRM skeleton out of this route.
export default function Loading() {
  return (
    <>
      <AppPageHeading>
        <h1 className="truncate text-sm font-medium">App page</h1>
      </AppPageHeading>
      <span role="status" className="sr-only">
        Loading app page…
      </span>
    </>
  );
}
