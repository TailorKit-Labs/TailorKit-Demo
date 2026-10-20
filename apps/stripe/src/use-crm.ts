import { useEffect, useState } from "preact/hooks";
import { tools } from "#tailorkit";
import type { Contact, Deal } from "./data";

export function useCRM(workspaceId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    workspaceId: string;
    contacts: Contact[];
    deals: Deal[];
    loading: boolean;
    error: string;
  }>({ workspaceId, contacts: [], deals: [], loading: true, error: "" });
  useEffect(() => {
    let active = true;
    setState({ workspaceId, contacts: [], deals: [], loading: true, error: "" });
    void Promise.all([tools.contacts.list({}), tools.deals.list({})])
      .then(([contacts, deals]) => {
        if (active)
          setState({
            workspaceId,
            contacts: contacts.contacts,
            deals: deals.deals,
            loading: false,
            error: "",
          });
      })
      .catch(() => {
        if (active)
          setState({
            workspaceId,
            contacts: [],
            deals: [],
            loading: false,
            error: "CRM links could not be loaded.",
          });
      });
    return () => {
      active = false;
    };
  }, [workspaceId, attempt]);
  return {
    ...(state.workspaceId === workspaceId
      ? state
      : { contacts: [], deals: [], loading: true, error: "" }),
    retry: () => setAttempt((value) => value + 1),
  };
}
