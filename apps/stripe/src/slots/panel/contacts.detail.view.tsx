import { useState } from "preact/hooks";
import { defineView } from "tailorkit/client";
import { Badge, Button, Empty, Flex, Heading } from "#tailorkit";
import { ContractDetail, CustomerDetail } from "../../components";
import { contracts, customerForContact, type Contact, type Deal } from "../../data";

const view = defineView({ view: "/contacts/detail", component: ContactPanel });

function ContactPanel() {
  const { workspace, contact, contacts, deals } = view.useContext();
  return (
    <Details
      key={`${workspace.id}:${contact.id}`}
      contact={contact}
      contacts={contacts}
      deals={deals}
    />
  );
}

function Details({
  contact,
  contacts,
  deals,
}: {
  contact: Contact;
  contacts: Contact[];
  deals: Deal[];
}) {
  const [contractId, setContractId] = useState<string>();
  const customer = customerForContact(contact);
  const contract = contracts.find((item) => item.id === contractId);
  return (
    <Flex direction="column" gap="lg">
      <Flex align="center" gap="sm">
        <Heading text="Stripe" level="h2" />
        <Badge text="Demo data" variant="secondary" />
      </Flex>
      {!customer ? (
        <Empty title="No linked Stripe customer" description={contact.company || contact.email} />
      ) : contract ? (
        <>
          <Button
            label={`Back to ${customer.company}`}
            variant="ghost"
            size="sm"
            onClick={() => setContractId(undefined)}
          />
          <ContractDetail
            compact
            contract={contract}
            contacts={contacts}
            deals={deals}
            onCustomer={() => setContractId(undefined)}
          />
        </>
      ) : (
        <CustomerDetail
          compact
          customer={customer}
          contacts={contacts}
          onContract={setContractId}
        />
      )}
    </Flex>
  );
}

export default view;
