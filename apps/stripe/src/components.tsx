import type { ComponentChildren } from "preact";
import {
  Badge,
  Box,
  Button,
  Card,
  Empty,
  Flex,
  Grid,
  Heading,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  tools,
} from "#tailorkit";
import {
  customerContracts,
  customerInvoices,
  customers,
  dateLabel,
  isRecurring,
  linkedContacts,
  linkedDeal,
  money,
  monthlyAmount,
  totalPaid,
  type Contact,
  type Contract,
  type Customer,
  type Deal,
  type Invoice,
} from "./data";

export function Status({ value }: { value: string }) {
  return (
    <Badge
      text={value}
      variant={
        value === "Paid" || value === "Active"
          ? "success"
          : value === "Open" || value === "Past due"
            ? "warning"
            : "secondary"
      }
    />
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column" gap="xs" minWidth="0" overflowWrap="anywhere">
      <Text text={label} tone="muted" size="xs" />
      <Text text={value} size="sm" />
    </Flex>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Box border="solid" borderColor="default" radius="lg" padding="md">
      <Flex direction="column" gap="sm">
        <Text text={label} tone="muted" size="sm" />
        <Heading text={value} level="h2" />
        {detail ? <Text text={detail} size="xs" tone="muted" /> : null}
      </Flex>
    </Box>
  );
}

export function ScrollTable({ children, label }: { children: ComponentChildren; label: string }) {
  return (
    <Box overflow="auto" width="100%">
      <Table label={label}>{children}</Table>
    </Box>
  );
}

export function Invoices({
  records,
  onContract,
  compact = false,
}: {
  records: Invoice[];
  onContract?: (id: string) => void;
  compact?: boolean;
}) {
  if (!records.length) return <Empty title="No invoices" />;
  return (
    <ScrollTable label="Invoices">
      <TableHeader>
        <TableRow>
          <TableHead text="Invoice" />
          <TableHead text="Date" />
          <TableHead text="Amount" />
          <TableHead text="Status" />
          {!compact ? <TableHead text="Contract" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Text text={invoice.id} size="xs" />
            </TableCell>
            <TableCell>
              <Text text={dateLabel(invoice.date)} size="sm" />
            </TableCell>
            <TableCell>
              <Text text={money(invoice.amount)} size="sm" />
            </TableCell>
            <TableCell>
              <Status value={invoice.status} />
            </TableCell>
            {!compact ? (
              <TableCell>
                {onContract ? (
                  <Button
                    label={invoice.contractId}
                    variant="link"
                    size="xs"
                    onClick={() => onContract(invoice.contractId)}
                  />
                ) : (
                  <Text text={invoice.contractId} size="xs" />
                )}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </ScrollTable>
  );
}

export function Contracts({
  records,
  onSelect,
  compact = false,
  onCustomer,
}: {
  records: Contract[];
  onSelect: (id: string) => void;
  compact?: boolean;
  onCustomer?: (id: string) => void;
}) {
  if (!records.length) return <Empty title="No contracts found" />;
  if (compact)
    return (
      <Flex direction="column" gap="sm">
        {records.map((contract) => (
          <Box key={contract.id} border="solid" borderColor="default" radius="lg" padding="md">
            <Flex direction="column" gap="sm">
              <Flex justify="between" align="center" gap="sm" wrap="wrap">
                <Button
                  label={contract.title}
                  variant="link"
                  size="sm"
                  onClick={() => onSelect(contract.id)}
                />
                <Status value={contract.status} />
              </Flex>
              <Text
                text={`${money(contract.amount)} / ${contract.interval} · ${contract.plan}`}
                size="sm"
                tone="muted"
              />
            </Flex>
          </Box>
        ))}
      </Flex>
    );
  return (
    <ScrollTable label="Contracts">
      <TableHeader>
        <TableRow>
          <TableHead text="Contract" />
          {onCustomer ? <TableHead text="Customer" /> : null}
          <TableHead text="Status" />
          <TableHead text="Amount" />
          <TableHead text="Next billing" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((contract) => (
          <TableRow key={contract.id}>
            <TableCell>
              <Button
                label={contract.title}
                variant="link"
                size="sm"
                onClick={() => onSelect(contract.id)}
              />
              <Text text={contract.id} size="xs" tone="muted" />
            </TableCell>
            {onCustomer ? (
              <TableCell>
                <Button
                  label={customers.find((customer) => customer.id === contract.customerId)!.company}
                  variant="link"
                  size="sm"
                  onClick={() => onCustomer(contract.customerId)}
                />
              </TableCell>
            ) : null}
            <TableCell>
              <Status value={contract.status} />
            </TableCell>
            <TableCell>
              <Text text={`${money(contract.amount)} / ${contract.interval}`} size="sm" />
            </TableCell>
            <TableCell>
              <Text
                text={contract.status === "Canceled" ? "—" : dateLabel(contract.renewal)}
                size="sm"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ScrollTable>
  );
}

function navigate(href: string) {
  void tools.ui.navigate({ href }).catch(() => {
    void tools.ui.notify({ title: "Could not open CRM record", type: "error" }).catch(() => {});
  });
}

export function CustomerDetail({
  customer,
  contacts,
  onContract,
  compact = false,
  linksLoading = false,
}: {
  customer: Customer;
  contacts: Contact[];
  onContract: (id: string) => void;
  compact?: boolean;
  linksLoading?: boolean;
}) {
  const records = customerContracts(customer.id);
  const payments = customerInvoices(customer.id);
  const links = linkedContacts(customer, contacts);
  const outstanding = payments
    .filter((invoice) => invoice.status === "Open")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  return (
    <Flex direction="column" gap="lg">
      <Flex justify="between" align="center" gap="sm" wrap="wrap">
        <Heading text={customer.company} level="h2" />
        <Badge text={customer.id} variant="outline" />
      </Flex>
      <Grid columns={compact ? 1 : { default: 1, sm: 3 }} gap="md">
        <Metric label="Total paid" value={money(totalPaid(payments))} />
        <Metric
          label="Monthly recurring"
          value={money(
            Math.round(
              records
                .filter(isRecurring)
                .reduce((sum, contract) => sum + monthlyAmount(contract), 0),
            ),
          )}
        />
        <Metric label="Outstanding" value={money(outstanding)} />
      </Grid>
      <Grid columns={compact ? 1 : { default: 1, md: 2 }} gap="md">
        <Card title="Billing details">
          <Flex direction="column" gap="md">
            <Field label="Billing contact" value={customer.name} />
            <Field label="Email" value={customer.email} />
            <Field label="Address" value={`${customer.address}, ${customer.country}`} />
            <Field label="Payment method" value={customer.card} />
            <Field label="Currency" value="USD" />
          </Flex>
        </Card>
        <Card title="CRM contacts">
          <Flex direction="column" gap="sm">
            {linksLoading ? (
              <Text text="Loading links…" size="sm" tone="muted" />
            ) : links.length ? (
              links.map((contact) => (
                <Flex key={contact.id} direction="column" gap="xs">
                  <Button
                    label={contact.name}
                    variant="link"
                    size="sm"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  />
                  <Text text={contact.email} size="sm" tone="muted" />
                </Flex>
              ))
            ) : (
              <Text text="No matching CRM contacts" tone="muted" size="sm" />
            )}
          </Flex>
        </Card>
      </Grid>
      <Flex direction="column" gap="md">
        <Heading text={`Contracts (${records.length})`} level="h3" />
        <Contracts records={records} onSelect={onContract} compact={compact} />
      </Flex>
      <Separator />
      <Flex direction="column" gap="md">
        <Heading text="Invoices" level="h3" />
        <Invoices records={payments} compact={compact} onContract={onContract} />
      </Flex>
    </Flex>
  );
}

export function ContractDetail({
  contract,
  contacts,
  deals,
  onCustomer,
  compact = false,
  linksLoading = false,
}: {
  contract: Contract;
  contacts: Contact[];
  deals: Deal[];
  onCustomer: (id: string) => void;
  compact?: boolean;
  linksLoading?: boolean;
}) {
  const customer = customers.find((item) => item.id === contract.customerId)!;
  const payments = customerInvoices(customer.id).filter(
    (invoice) => invoice.contractId === contract.id,
  );
  const deal = linkedDeal(contract, contacts, deals);
  return (
    <Flex direction="column" gap="lg">
      <Flex justify="between" align="center" wrap="wrap" gap="sm">
        <Heading text={contract.title} level="h2" />
        <Status value={contract.status} />
      </Flex>
      <Text text={contract.id} tone="muted" size="sm" />
      <Grid columns={compact ? 1 : { default: 1, md: 2 }} gap="md">
        <Card title="Contract">
          <Flex direction="column" gap="md">
            <Field label="Plan" value={contract.plan} />
            <Field
              label="Billing"
              value={`${money(contract.amount)} / ${contract.interval} · USD`}
            />
            <Field label="Started" value={dateLabel(contract.start)} />
            <Field
              label={
                contract.status === "Canceled"
                  ? "Ended"
                  : contract.status === "Trialing"
                    ? "Trial ends"
                    : "Next billing"
              }
              value={dateLabel(contract.renewal)}
            />
            <Field label="Total paid" value={money(totalPaid(payments))} />
          </Flex>
        </Card>
        <Card title="Linked records">
          <Flex direction="column" gap="md">
            <Flex direction="column" gap="xs">
              <Text text="Customer" size="xs" tone="muted" />
              <Button
                label={customer.company}
                variant="link"
                size="sm"
                onClick={() => onCustomer(customer.id)}
              />
              <Text text={customer.email} size="sm" tone="muted" />
            </Flex>
            <Separator />
            {linksLoading ? (
              <Text text="Loading CRM link…" size="sm" tone="muted" />
            ) : deal ? (
              <>
                <Field label="CRM opportunity" value={deal.title} />
                <Field label="Opportunity value" value={money(deal.value * 100)} />
                <Button
                  label="View in pipeline"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/pipeline")}
                />
              </>
            ) : (
              <Text text="No matching CRM opportunity" size="sm" tone="muted" />
            )}
          </Flex>
        </Card>
      </Grid>
      <Flex direction="column" gap="md">
        <Heading text="Invoices" level="h3" />
        <Invoices records={payments} compact={compact} />
      </Flex>
    </Flex>
  );
}
