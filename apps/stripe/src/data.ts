export type Customer = {
  id: string;
  company: string;
  name: string;
  email: string;
  country: string;
  address: string;
  card: string;
};
export type Contract = {
  id: string;
  customerId: string;
  title: string;
  plan: string;
  amount: number;
  interval: "month" | "year";
  status: "Active" | "Past due" | "Canceled" | "Trialing";
  start: string;
  end?: string;
  renewal: string;
};
export type Invoice = {
  id: string;
  customerId: string;
  contractId: string;
  date: string;
  amount: number;
  status: "Paid" | "Open" | "Void";
};
export type Contact = { id: string; name: string; email: string; company: string };
export type Deal = { id: string; title: string; contactId: string | null; value: number };

export const asOf = "2026-10-20";
export const customers: Customer[] = [
  {
    id: "cus_layers",
    company: "Layers",
    name: "Olivia Rhye",
    email: "olivia@layers.example",
    country: "United States",
    address: "123 Market St, San Francisco, CA 94103",
    card: "Visa ···· 4242",
  },
  {
    id: "cus_sisyphus",
    company: "Sisyphus",
    name: "Phoenix Baker",
    email: "phoenix@sisyphus.example",
    country: "United Kingdom",
    address: "42 Old Street, London EC1V 9AE",
    card: "Mastercard ···· 5556",
  },
  {
    id: "cus_catalog",
    company: "Catalog",
    name: "Lana Steiner",
    email: "lana@catalog.example",
    country: "Australia",
    address: "80 Collins St, Melbourne VIC 3000",
    card: "Visa ···· 1881",
  },
  {
    id: "cus_circooles",
    company: "Circooles",
    name: "Demi Wilkinson",
    email: "demi@circooles.example",
    country: "United States",
    address: "350 5th Ave, New York, NY 10118",
    card: "Visa ···· 9021",
  },
  {
    id: "cus_hourglass",
    company: "Hourglass",
    name: "Drew Cano",
    email: "drew@hourglass.example",
    country: "Canada",
    address: "100 King St W, Toronto ON M5X 1A9",
    card: "Mastercard ···· 8210",
  },
  {
    id: "cus_commandr",
    company: "Command+R",
    name: "Natali Craig",
    email: "natali@commandr.example",
    country: "United States",
    address: "600 Congress Ave, Austin, TX 78701",
    card: "Visa ···· 6012",
  },
];

export const contracts: Contract[] = [
  {
    id: "sub_layers",
    customerId: "cus_layers",
    title: "Brand & website refresh",
    plan: "Business",
    amount: 100000,
    interval: "month",
    status: "Active",
    start: "2026-05-01",
    renewal: "2026-11-01",
  },
  {
    id: "sub_sisyphus",
    customerId: "cus_sisyphus",
    title: "Enterprise annual plan",
    plan: "Enterprise",
    amount: 2450000,
    interval: "year",
    status: "Active",
    start: "2026-07-01",
    renewal: "2027-07-01",
  },
  {
    id: "sub_catalog",
    customerId: "cus_catalog",
    title: "Product design partnership",
    plan: "Business",
    amount: 150000,
    interval: "month",
    status: "Past due",
    start: "2026-06-01",
    renewal: "2026-11-01",
  },
  {
    id: "sub_circooles",
    customerId: "cus_circooles",
    title: "Growth platform rollout",
    plan: "Enterprise",
    amount: 300000,
    interval: "month",
    status: "Active",
    start: "2026-05-01",
    renewal: "2026-11-01",
  },
  {
    id: "sub_hourglass",
    customerId: "cus_hourglass",
    title: "Team workspace expansion",
    plan: "Team",
    amount: 850000,
    interval: "year",
    status: "Active",
    start: "2026-08-01",
    renewal: "2027-08-01",
  },
  {
    id: "sub_commandr",
    customerId: "cus_commandr",
    title: "Customer experience sprint",
    plan: "Business",
    amount: 350000,
    interval: "month",
    status: "Canceled",
    start: "2026-05-01",
    end: "2026-09-30",
    renewal: "2026-09-30",
  },
  {
    id: "sub_layers_team",
    customerId: "cus_layers",
    title: "Team workspace",
    plan: "Team",
    amount: 25000,
    interval: "month",
    status: "Active",
    start: "2026-09-01",
    renewal: "2026-11-01",
  },
  {
    id: "sub_hourglass_trial",
    customerId: "cus_hourglass",
    title: "Analytics add-on",
    plan: "Analytics",
    amount: 15000,
    interval: "month",
    status: "Trialing",
    start: "2026-10-14",
    renewal: "2026-10-28",
  },
];

// Integer cents throughout; each invoice is the source of dashboard revenue.
export const invoices: Invoice[] = contracts
  .flatMap<Invoice>((contract) => {
    if (contract.status === "Trialing") return [];
    const dates =
      contract.interval === "year"
        ? [contract.start]
        : ["05", "06", "07", "08", "09", "10"].map((month) => `2026-${month}-01`);
    return dates
      .filter(
        (date) => date >= contract.start && date <= asOf && (!contract.end || date <= contract.end),
      )
      .map((date) => ({
        id: `in_${contract.id.slice(4)}_${date.slice(0, 7).replace("-", "")}`,
        customerId: contract.customerId,
        contractId: contract.id,
        date,
        amount: contract.amount,
        status: contract.status === "Past due" && date.startsWith("2026-10") ? "Open" : "Paid",
      }));
  })
  .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const monthlyAmount = (contract: Contract) =>
  contract.amount / (contract.interval === "year" ? 12 : 1);
export const isRecurring = (contract: Contract) =>
  contract.status === "Active" || contract.status === "Past due";
export const customerContracts = (id: string) =>
  contracts.filter((contract) => contract.customerId === id);
export const customerInvoices = (id: string) =>
  invoices.filter((invoice) => invoice.customerId === id);
export const totalPaid = (records: Invoice[]) =>
  records
    .filter((invoice) => invoice.status === "Paid")
    .reduce((total, invoice) => total + invoice.amount, 0);

export function linkedContacts(customer: Customer, contacts: Contact[]) {
  const email = customer.email.toLowerCase();
  return contacts.filter(
    (contact) =>
      contact.email.toLowerCase() === email ||
      contact.company.trim().toLowerCase() === customer.company.toLowerCase(),
  );
}
export function customerForContact(contact: Contact) {
  return (
    customers.find((customer) => customer.email.toLowerCase() === contact.email.toLowerCase()) ??
    customers.find(
      (customer) => customer.company.toLowerCase() === contact.company.trim().toLowerCase(),
    )
  );
}
export function linkedDeal(contract: Contract, contacts: Contact[], deals: Deal[]) {
  const customer = customers.find((item) => item.id === contract.customerId)!;
  const ids = new Set(linkedContacts(customer, contacts).map((contact) => contact.id));
  return deals.find(
    (deal) =>
      ids.has(deal.contactId ?? "") &&
      deal.title.trim().toLowerCase() === `${customer.company} · ${contract.title}`.toLowerCase(),
  );
}

export const periods = [
  { value: "month", label: "October 2026", start: "2026-10-01" },
  { value: "quarter", label: "Last 3 months", start: "2026-08-01" },
  { value: "half", label: "Last 6 months", start: "2026-05-01" },
] as const;

export function salesSummary(start: string) {
  const records = invoices.filter((invoice) => invoice.date >= start && invoice.date <= asOf);
  return {
    revenue: totalPaid(records),
    outstanding: records
      .filter((invoice) => invoice.status === "Open")
      .reduce((sum, invoice) => sum + invoice.amount, 0),
    payments: records.filter((invoice) => invoice.status === "Paid").length,
    mrr: contracts.filter(isRecurring).reduce((sum, contract) => sum + monthlyAmount(contract), 0),
  };
}
