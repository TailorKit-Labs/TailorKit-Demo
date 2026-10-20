import { defineView } from "tailorkit/client";
import { StripeApp } from "../../app";
import { useCRM } from "../../use-crm";

const view = defineView({ view: "/", component: Panel });

function Panel() {
  const { workspace } = view.useContext();
  const crm = useCRM(workspace.id);
  return <StripeApp key={workspace.id} compact {...crm} />;
}

export default view;
