import { defineView } from "patchsmith/client";
import { z } from "zod";
import {
  Badge,
  Box,
  Button,
  Card,
  Empty,
  Flex,
  Grid,
  Heading,
  AreaChart,
  BarChart,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  tools,
} from "#patchsmith";
import { useState } from "preact/hooks";
import { useBilling } from "../../use-billing";
import { BillingStatus, LoadState, Stat } from "../../components";
import { money, shortDate, summarize } from "../../billing";

const view = defineView({
  view: "/",
  instances: {
    cache: "static",
    dataSchema: z.object({}),
    resolve: () => [{ key: "overview", metadata: { label: "Stripe analytics" }, data: {} }],
  },
  component: StripeAnalytics,
});

function StripeAnalytics() {
  const { workspace } = view.useContext();
  return <Analytics key={workspace.id} />;
}

function Analytics() {
  const state = useBilling();
  const [navigationError, setNavigationError] = useState("");
  if (state.loading || state.error) return <LoadState {...state} layout="page" />;
  const { customers } = state;
  const summary = summarize(customers);
  async function openContact(id: string) {
    setNavigationError("");
    try {
      await tools.ui.navigate({ href: `/contacts/${id}` });
    } catch {
      setNavigationError("Couldn't open this contact. Please try again.");
    }
  }
  return (
    <Flex direction="column" gap="6" height="full" overflow="auto">
      <Flex justify="between" align="center" wrap="wrap" gap="3">
        <Flex direction="column" gap="2">
          <Heading text="Billing overview" />
          <Text
            text="Subscriptions and payments across all your contacts."
            tone="muted"
            size="sm"
          />
        </Flex>
      </Flex>
      <Grid columns={{ default: 1, sm: 2, xl: 4 }} gap="4">
        <Stat
          label="Collected revenue"
          value={money(summary.revenue)}
          description="All paid demo invoices"
        />
        <Stat
          label="Monthly recurring revenue"
          value={money(summary.mrr)}
          description="Active and past-due subscriptions"
        />
        <Stat
          label="Active subscriptions"
          value={String(summary.active)}
          description={`${summary.trials} on trial · ${customers.length} total contacts`}
        />
        <Stat
          label="Outstanding balance"
          value={money(summary.outstanding)}
          description={`${summary.pastDue} past-due subscriptions`}
        />
      </Grid>
      {!customers.length ? (
        <Empty
          title="No contacts yet"
          description="Add a contact in the CRM to start seeing demo billing and analytics."
        />
      ) : (
        <>
          <Grid columns={{ default: 1, lg: 2 }} gap="4">
            <Card
              title="Revenue by month"
              description="Paid invoices · last six months with billing activity"
            >
              <AreaChart
                label="Collected revenue by month"
                valueLabel="Collected revenue"
                valueFormat="currency"
                currency="USD"
                data={summary.months.map(({ month, amount }) => ({
                  label: new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${month}-01T00:00:00Z`)),
                  value: amount / 100,
                }))}
              />
            </Card>
            <Card
              title="Plan breakdown"
              description="All contacts, including trials and canceled subscriptions"
            >
              <BarChart
                label="Contacts by subscription plan"
                valueLabel="Contacts"
                data={(["Starter", "Growth", "Scale"] as const).map((plan) => ({
                  label: plan,
                  value: customers.filter(({ billing }) => billing.plan === plan).length,
                }))}
              />
            </Card>
          </Grid>
          <Card
            title="Contact subscriptions"
            description="Open a contact to see their billing details."
          >
            {navigationError ? <Text text={navigationError} tone="destructive" size="sm" /> : null}
            <Box overflow="auto">
              <Table label="Contact subscriptions">
                <TableHeader>
                  <TableRow>
                    {["Contact", "Plan", "Status", "Monthly amount"].map((text) => (
                      <TableHead key={text} text={text} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Flex direction="column" gap="1">
                          <Button
                            label={customer.name}
                            variant="link"
                            size="sm"
                            onClick={() => openContact(customer.id)}
                          />
                          <Text text={customer.company} tone="muted" size="xs" />
                        </Flex>
                      </TableCell>
                      <TableCell>
                        <Text text={customer.billing.plan} size="sm" />
                      </TableCell>
                      <TableCell>
                        <BillingStatus status={customer.billing.status} />
                      </TableCell>
                      <TableCell>
                        <Text text={money(customer.billing.monthlyAmount)} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
          <Card
            title="Recent invoices"
            description="The 10 most recent invoices across your contacts"
          >
            <Box overflow="auto">
              <Table label="Recent Stripe invoices">
                <TableHeader>
                  <TableRow>
                    {["Contact", "Date", "Amount", "Status"].map((text) => (
                      <TableHead key={text} text={text} />
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Text text={invoice.name} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Text text={shortDate(invoice.date)} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Text text={money(invoice.amount)} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Badge
                          text={
                            invoice.status === "paid"
                              ? "Paid"
                              : invoice.status === "open"
                                ? "Open"
                                : "Void"
                          }
                          variant={
                            invoice.status === "paid"
                              ? "success"
                              : invoice.status === "open"
                                ? "warning"
                                : "secondary"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {!summary.invoices.length ? (
              <Text text="No invoices yet." tone="muted" size="sm" />
            ) : null}
          </Card>
        </>
      )}
      <Text
        text="Simulated Stripe data, saved per workspace. No real payments are processed."
        tone="muted"
        size="xs"
      />
    </Flex>
  );
}

export default view;
