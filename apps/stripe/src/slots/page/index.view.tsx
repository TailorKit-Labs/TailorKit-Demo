import { defineView } from "tailorkit/client";
import { z } from "zod";
import { StripeApp } from "../../app";
import { useCRM } from "../../use-crm";

const view = defineView({
  view: "/",
  component: Dashboard,
  instances: {
    dataSchema: z.object({}),
    resolve: () => [{ key: "sales", metadata: { label: "Stripe" }, data: {} }],
  },
});

function Dashboard() {
  const { workspace } = view.useContext();
  const crm = useCRM(workspace.id);
  return <StripeApp key={workspace.id} {...crm} />;
}

export default view;
