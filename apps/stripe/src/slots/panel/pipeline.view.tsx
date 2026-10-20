import { useState } from "preact/hooks";
import { defineView } from "tailorkit/client";
import { Badge, Button, Empty, Flex, Heading } from "#tailorkit";
import { ContractDetail, Contracts, CustomerDetail } from "../../components";
import { contracts, customers, linkedDeal, type Contact, type Deal } from "../../data";

const view = defineView({ view: "/pipeline", component: Pipeline });

function Pipeline() {
  const { workspace, contacts, deals } = view.useContext();
  return <LinkedContracts key={workspace.id} contacts={contacts} deals={deals} />;
}

function LinkedContracts({ contacts, deals }: { contacts: Contact[]; deals: Deal[] }) {
  const [contractId, setContractId] = useState<string>();
  const [customerId, setCustomerId] = useState<string>();
  const linked = contracts.filter((contract) => linkedDeal(contract, contacts, deals));
  const selected = contracts.find((contract) => contract.id === contractId);
  const customer = customers.find((item) => item.id === customerId);
  return (
    <Flex direction="column" gap="lg">
      <Flex align="center" gap="sm">
        <Heading text="Stripe" level="h2" />
        <Badge text="Demo data" variant="secondary" />
      </Flex>
      {customer ? (
        <>
          <Button
            label="Back to contract"
            variant="ghost"
            size="sm"
            onClick={() => setCustomerId(undefined)}
          />
          <CustomerDetail
            compact
            customer={customer}
            contacts={contacts}
            onContract={(id) => {
              setContractId(id);
              setCustomerId(undefined);
            }}
          />
        </>
      ) : selected ? (
        <>
          <Button
            label="Back to linked contracts"
            variant="ghost"
            size="sm"
            onClick={() => setContractId(undefined)}
          />
          <ContractDetail
            compact
            contract={selected}
            contacts={contacts}
            deals={deals}
            onCustomer={setCustomerId}
          />
        </>
      ) : (
        <>
          <Heading text="Linked contracts" level="h3" />
          {linked.length ? (
            <Contracts compact records={linked} onSelect={setContractId} />
          ) : (
            <Empty title="No linked contracts in this pipeline" />
          )}
        </>
      )}
    </Flex>
  );
}

export default view;
