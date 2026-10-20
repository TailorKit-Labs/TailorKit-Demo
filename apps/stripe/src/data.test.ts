import { describe, expect, it } from "vite-plus/test";
import {
  contracts,
  customerForContact,
  customers,
  invoices,
  linkedContacts,
  linkedDeal,
  salesSummary,
  totalPaid,
} from "./data";

describe("billing demo", () => {
  it("keeps every invoice tied to its customer and contract", () => {
    expect(new Set(invoices.map((invoice) => invoice.id)).size).toBe(invoices.length);
    for (const invoice of invoices) {
      const contract = contracts.find((item) => item.id === invoice.contractId)!;
      expect(contract.customerId).toBe(invoice.customerId);
      expect(customers.some((customer) => customer.id === invoice.customerId)).toBe(true);
      expect(invoice.amount).toBe(contract.amount);
      expect(invoice.date >= contract.start).toBe(true);
      expect(!contract.end || invoice.date <= contract.end).toBe(true);
    }
    expect(invoices.some((invoice) => invoice.contractId === "sub_hourglass_trial")).toBe(false);
  });

  it("calculates period revenue from paid invoices and excludes canceled and trial contracts from MRR", () => {
    const october = salesSummary("2026-10-01");
    expect(october.revenue).toBe(425000);
    expect(october.outstanding).toBe(150000);
    expect(october.payments).toBe(3);
    expect(Math.round(october.mrr)).toBe(850000);
    expect(salesSummary("2026-05-01").revenue).toBe(totalPaid(invoices));
    expect(salesSummary("2026-08-01").revenue).toBeLessThan(salesSummary("2026-05-01").revenue);
  });

  it("matches customer identity without assigning unknown CRM contacts", () => {
    const exact = { id: "one", name: "Olivia", email: "OLIVIA@LAYERS.EXAMPLE", company: "Renamed" };
    const colleague = {
      id: "two",
      name: "William",
      email: "william@layers.example",
      company: " Layers ",
    };
    const unknown = {
      id: "three",
      name: "Unknown",
      email: "unknown@example.com",
      company: "Other",
    };
    expect(customerForContact(exact)?.id).toBe("cus_layers");
    expect(customerForContact(colleague)?.id).toBe("cus_layers");
    expect(customerForContact(unknown)).toBeUndefined();
    expect(
      linkedContacts(customers[0], [exact, colleague, unknown]).map((item) => item.id),
    ).toEqual(["one", "two"]);
  });

  it("links contracts only when both company contact and opportunity title match", () => {
    const contact = {
      id: "one",
      name: "Olivia",
      email: "olivia@layers.example",
      company: "Layers",
    };
    const deal = {
      id: "deal",
      contactId: contact.id,
      title: "Layers · Brand & website refresh",
      value: 12000,
    };
    expect(linkedDeal(contracts[0], [contact], [deal])?.id).toBe("deal");
    expect(linkedDeal(contracts[0], [contact], [{ ...deal, contactId: "other" }])).toBeUndefined();
    expect(
      linkedDeal(contracts[0], [contact], [{ ...deal, title: "Another contract" }]),
    ).toBeUndefined();
  });
});
