import { useState } from "preact/hooks";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Empty,
  Flex,
  Grid,
  Heading,
  Input,
  Progress,
  Select,
  Separator,
  Text,
} from "#tailorkit";
import { ContractDetail, Contracts, CustomerDetail, Field, Invoices, Metric } from "./components";
import {
  asOf,
  contracts,
  customerContracts,
  customerInvoices,
  customers,
  dateLabel,
  invoices,
  isRecurring,
  linkedContacts,
  money,
  periods,
  salesSummary,
  totalPaid,
  type Contact,
  type Deal,
} from "./data";

type Section = "Overview" | "Customers" | "Contracts";
type Selection = { kind: "customer" | "contract"; id: string };
export type CRMProps = {
  contacts: Contact[];
  deals: Deal[];
  loading?: boolean;
  error?: string;
  retry?: () => void;
};

export function StripeApp({ compact = false, ...crm }: CRMProps & { compact?: boolean }) {
  const [section, setSection] = useState<Section>("Overview");
  const [selected, setSelected] = useState<Selection>();
  const [history, setHistory] = useState<Selection[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [period, setPeriod] = useState("half");
  const chosenPeriod = periods.find((item) => item.value === period) ?? periods[2];
  const summary = salesSummary(chosenPeriod.start);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingCustomers = customers.filter((customer) =>
    `${customer.company} ${customer.name} ${customer.email} ${customer.id}`
      .toLowerCase()
      .includes(normalizedQuery),
  );
  const matchingContracts = contracts.filter((contract) => {
    const customer = customers.find((item) => item.id === contract.customerId)!;
    return (
      (status === "All statuses" || contract.status === status) &&
      `${contract.title} ${contract.id} ${contract.plan} ${customer.company}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  });
  const selectedCustomer =
    selected?.kind === "customer"
      ? customers.find((customer) => customer.id === selected.id)
      : undefined;
  const selectedContract =
    selected?.kind === "contract"
      ? contracts.find((contract) => contract.id === selected.id)
      : undefined;

  function select(next: Selection) {
    if (selected) setHistory((current) => [...current, selected]);
    setSelected(next);
  }
  function back() {
    setSelected(history.at(-1));
    setHistory((current) => current.slice(0, -1));
  }
  function changeSection(next: Section) {
    setSection(next);
    setSelected(undefined);
    setHistory([]);
    setQuery("");
    setStatus("All statuses");
  }

  return (
    <Flex
      direction="column"
      gap="lg"
      padding={compact ? "none" : { default: "md", md: "xl" }}
      width="100%"
      minWidth="0"
    >
      <Flex justify="between" align="center" gap="md" wrap="wrap">
        <Flex align="center" gap="sm">
          <Heading text="Stripe" level="h2" />
          <Badge text="Demo data" variant="secondary" />
        </Flex>
        <Text text={`${dateLabel(asOf)} · USD`} size="xs" tone="muted" />
      </Flex>
      <Flex gap="sm" wrap="wrap">
        {(["Overview", "Customers", "Contracts"] as const).map((item) => (
          <Button
            key={item}
            label={item}
            variant={section === item ? "secondary" : "ghost"}
            size="sm"
            onClick={() => changeSection(item)}
          />
        ))}
      </Flex>
      <Separator />
      {crm.error ? (
        <Flex direction="column" gap="sm">
          <Alert title={crm.error} variant="warning" />
          {crm.retry ? (
            <Button label="Retry CRM links" variant="outline" size="sm" onClick={crm.retry} />
          ) : null}
        </Flex>
      ) : null}
      {selected ? <Button label="Back" variant="ghost" size="sm" onClick={back} /> : null}
      {selectedCustomer ? (
        <CustomerDetail
          customer={selectedCustomer}
          contacts={crm.contacts}
          linksLoading={crm.loading}
          compact={compact}
          onContract={(id) => select({ kind: "contract", id })}
        />
      ) : selectedContract ? (
        <ContractDetail
          contract={selectedContract}
          contacts={crm.contacts}
          deals={crm.deals}
          linksLoading={crm.loading}
          compact={compact}
          onCustomer={(id) => select({ kind: "customer", id })}
        />
      ) : section === "Overview" ? (
        <>
          <Flex justify="between" align="center" gap="md" wrap="wrap">
            <Heading text="Sales overview" level="h3" />
            <Select
              label="Period"
              value={period}
              options={periods.map(({ value, label }) => ({ value, label }))}
              onChange={({ value }) => setPeriod(value)}
            />
          </Flex>
          <Grid columns={compact ? 1 : { default: 1, sm: 2, lg: 4 }} gap="md">
            <Metric
              label="Revenue"
              value={money(summary.revenue)}
              detail={`${summary.payments} paid invoices`}
            />
            <Metric
              label="Monthly recurring"
              value={money(Math.round(summary.mrr))}
              detail="Active and past-due contracts"
            />
            <Metric
              label="Outstanding"
              value={money(summary.outstanding)}
              detail="Unpaid invoices in period"
            />
            <Metric
              label="Active customers"
              value={String(
                customers.filter((customer) => customerContracts(customer.id).some(isRecurring))
                  .length,
              )}
              detail={`${contracts.filter(isRecurring).length} recurring contracts`}
            />
          </Grid>
          <Grid columns={compact ? 1 : { default: 1, md: 2 }} gap="md">
            <Card title="Revenue by month">
              <Flex direction="column" gap="md">
                {["05", "06", "07", "08", "09", "10"]
                  .filter((month) => `2026-${month}-01` >= chosenPeriod.start)
                  .map((month) => {
                    const monthlyRevenue = totalPaid(
                      invoices.filter((invoice) => invoice.date.startsWith(`2026-${month}`)),
                    );
                    const peak = Math.max(
                      ...["05", "06", "07", "08", "09", "10"].map((value) =>
                        totalPaid(
                          invoices.filter((invoice) => invoice.date.startsWith(`2026-${value}`)),
                        ),
                      ),
                    );
                    return (
                      <Flex key={month} direction="column" gap="xs">
                        <Flex justify="between" gap="sm">
                          <Text text={dateLabel(`2026-${month}-01`).split(" ")[0]} size="sm" />
                          <Text text={money(monthlyRevenue)} size="sm" />
                        </Flex>
                        <Progress
                          label={`${dateLabel(`2026-${month}-01`)} revenue: ${money(monthlyRevenue)}`}
                          value={peak ? (monthlyRevenue / peak) * 100 : 0}
                        />
                      </Flex>
                    );
                  })}
              </Flex>
            </Card>
            <Card title="Needs attention">
              <Flex direction="column" gap="md">
                {contracts
                  .filter((contract) => contract.status === "Past due")
                  .map((contract) => (
                    <Flex key={contract.id} direction="column" gap="sm">
                      <Badge text="Past due" variant="warning" />
                      <Button
                        label={
                          customers.find((customer) => customer.id === contract.customerId)!.company
                        }
                        variant="link"
                        size="sm"
                        onClick={() => select({ kind: "customer", id: contract.customerId })}
                      />
                      <Field
                        label="Unpaid invoice"
                        value={money(
                          invoices
                            .filter(
                              (invoice) =>
                                invoice.contractId === contract.id && invoice.status === "Open",
                            )
                            .reduce((sum, invoice) => sum + invoice.amount, 0),
                        )}
                      />
                      <Button
                        label="View contract"
                        variant="outline"
                        size="sm"
                        onClick={() => select({ kind: "contract", id: contract.id })}
                      />
                    </Flex>
                  ))}
              </Flex>
            </Card>
          </Grid>
          <Flex direction="column" gap="md">
            <Heading text="Recent invoices" level="h3" />
            <Invoices
              records={invoices.filter((invoice) => invoice.date >= chosenPeriod.start).slice(0, 8)}
              compact={compact}
              onContract={(id) => select({ kind: "contract", id })}
            />
          </Flex>
        </>
      ) : section === "Customers" ? (
        <>
          <Flex justify="between" gap="md" align="center" wrap="wrap">
            <Heading text={`Customers (${matchingCustomers.length})`} level="h3" />
            <Input
              label="Search customers"
              type="search"
              value={query}
              placeholder="Company, email or customer ID"
              onChange={({ value }) => setQuery(value)}
            />
          </Flex>
          {matchingCustomers.length ? (
            <Grid columns={compact ? 1 : { default: 1, md: 2 }} gap="md">
              {matchingCustomers.map((customer) => (
                <Box
                  key={customer.id}
                  border="solid"
                  borderColor="default"
                  radius="lg"
                  padding="md"
                >
                  <Flex direction="column" gap="md">
                    <Flex justify="between" gap="sm" align="center" wrap="wrap">
                      <Button
                        label={customer.company}
                        variant="link"
                        onClick={() => select({ kind: "customer", id: customer.id })}
                      />
                      <Badge
                        text={
                          crm.loading
                            ? "Loading links…"
                            : linkedContacts(customer, crm.contacts).length
                              ? "CRM linked"
                              : "No CRM link"
                        }
                        variant="outline"
                      />
                    </Flex>
                    <Field label={customer.name} value={customer.email} />
                    <Flex justify="between" gap="md" wrap="wrap">
                      <Field
                        label="Total paid"
                        value={money(totalPaid(customerInvoices(customer.id)))}
                      />
                      <Field
                        label="Contracts"
                        value={String(customerContracts(customer.id).length)}
                      />
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Grid>
          ) : (
            <Empty title="No customers found" />
          )}
        </>
      ) : (
        <>
          <Heading text={`Contracts (${matchingContracts.length})`} level="h3" />
          <Grid columns={compact ? 1 : { default: 1, sm: 2 }} gap="md">
            <Input
              label="Search contracts"
              type="search"
              value={query}
              placeholder="Contract, company or plan"
              onChange={({ value }) => setQuery(value)}
            />
            <Select
              label="Status"
              value={status}
              options={["All statuses", "Active", "Past due", "Trialing", "Canceled"].map(
                (value) => ({ value, label: value }),
              )}
              onChange={({ value }) => setStatus(value)}
            />
          </Grid>
          <Contracts
            records={matchingContracts}
            onSelect={(id) => select({ kind: "contract", id })}
            onCustomer={(id) => select({ kind: "customer", id })}
            compact={compact}
          />
        </>
      )}
    </Flex>
  );
}
