import assert from "node:assert/strict";
import { test } from "node:test";
import { contract } from "../lib/tailorkit";
import {
  pageViewPaths,
  pageViews,
  overviewViewContext,
  contactsViewContext,
  contactViewContext,
  pipelineViewContext,
  tasksViewContext,
  settingsViewContext,
} from "../lib/tailorkit-views";
import type { Workspace } from "../lib/workspace";

const timestamp = "2026-10-17T00:00:00.000Z";
const workspace: Workspace = {
  tenant: { id: "private-workspace", name: "Demo", setupVersion: 2 },
  contacts: [
    {
      id: "alex",
      tenantId: "private-workspace",
      name: "Alex Chen",
      email: "alex@example.com",
      company: "Acme",
      role: "Designer",
      status: "customer",
      createdAt: timestamp,
    },
    {
      id: "sam",
      tenantId: "private-workspace",
      name: "Sam Lee",
      email: "sam@example.com",
      company: "Studio",
      role: "Founder",
      status: "lead",
      createdAt: timestamp,
    },
  ],
  deals: [
    {
      id: "open",
      tenantId: "private-workspace",
      title: "Open deal",
      value: 200,
      stage: "proposal",
      contactId: "alex",
      closeDate: timestamp,
      createdAt: timestamp,
      position: 0,
    },
    {
      id: "won",
      tenantId: "private-workspace",
      title: "Won deal",
      value: 500,
      stage: "won",
      contactId: "sam",
      closeDate: timestamp,
      createdAt: timestamp,
      position: 1,
    },
    {
      id: "lost",
      tenantId: "private-workspace",
      title: "Lost deal",
      value: 100,
      stage: "lost",
      contactId: null,
      closeDate: timestamp,
      createdAt: timestamp,
      position: 2,
    },
  ],
  tasks: [
    {
      id: "pending",
      tenantId: "private-workspace",
      title: "Call Alex",
      contactId: "alex",
      dueDate: timestamp,
      createdAt: timestamp,
      completed: false,
    },
    {
      id: "done",
      tenantId: "private-workspace",
      title: "Call Sam",
      contactId: "sam",
      dueDate: timestamp,
      createdAt: timestamp,
      completed: true,
    },
  ],
  activities: [
    {
      id: "alex-note",
      tenantId: "private-workspace",
      contactId: "alex",
      type: "note",
      title: "Note added",
      description: "  Keep spaces  ",
      createdAt: timestamp,
    },
    {
      id: "sam-note",
      tenantId: "private-workspace",
      contactId: "sam",
      type: "note",
      title: "Note added",
      description: "Other contact",
      createdAt: timestamp,
    },
  ],
};

void test("every page view is supported by every slot, with root fallback", () => {
  assert.deepEqual(Object.keys(contract.views), pageViewPaths);
  for (const slot of Object.values(contract.slots)) assert.deepEqual(slot.views, pageViewPaths);
});

void test("overview exposes public records and accurate workspace totals", () => {
  const context = pageViews["/overview"].parse(overviewViewContext(workspace));
  assert.deepEqual(context.summary, {
    contacts: 2,
    customers: 1,
    activeAccounts: 1,
    openDeals: 1,
    pipelineValue: 200,
    revenue: 500,
    pendingTasks: 1,
  });
  assert.equal(context.deals[0].closeDate, "2026-10-17");
  assert.equal(context.tasks[0].dueDate, "2026-10-17");
  assert.equal(context.recentActivities[0].description, "  Keep spaces  ");
  assert.equal(JSON.stringify(context).includes("private-workspace"), false);
});

void test("contacts support list state and collection-only context on detail pages", () => {
  const collection = contactsViewContext(workspace);
  assert.equal(pageViews["/contacts"].parse(collection).count, 2);
  const context = pageViews["/contacts"].parse({
    ...collection,
    filters: { query: "Acme", status: "customer" },
    sort: { field: "company", direction: "desc" },
    pagination: { page: 1, pageSize: 10, totalPages: 1, total: 1 },
    visibleContactIds: ["alex"],
    selectedContactIds: ["alex"],
  });
  assert.equal(context.contacts.length, 2);
  assert.equal(context.pagination?.total, 1);
  assert.deepEqual(context.visibleContactIds, ["alex"]);
  assert.deepEqual(context.selectedContactIds, ["alex"]);
});

void test("contact detail exposes full contact fields and only related records", () => {
  const context = pageViews["/contacts/detail"].parse(
    contactViewContext(workspace, workspace.contacts[0], "follow-ups"),
  );
  assert.equal(context.contact.role, "Designer");
  assert.equal(context.contact.status, "customer");
  assert.equal(context.activeTab, "follow-ups");
  assert.deepEqual(
    context.deals.map((row) => row.id),
    ["open"],
  );
  assert.deepEqual(
    context.tasks.map((row) => row.id),
    ["pending"],
  );
  assert.deepEqual(
    context.activities.map((row) => row.id),
    ["alex-note"],
  );
  assert.equal(JSON.stringify(context).includes("private-workspace"), false);
  const next = contactViewContext(workspace, workspace.contacts[1], "activity");
  assert.deepEqual(
    next.activities.map((row) => row.id),
    ["sam-note"],
  );
});

void test("pipeline context and stage totals match the displayed deals, including empty results", () => {
  const context = pageViews["/pipeline"].parse(
    pipelineViewContext(workspace, [workspace.deals[0]], "Acme"),
  );
  assert.equal(context.filters.query, "Acme");
  assert.deepEqual(
    context.deals.map((row) => row.id),
    ["open"],
  );
  assert.equal(context.totalValue, 200);
  assert.deepEqual(
    context.stages.find((row) => row.stage === "proposal"),
    { stage: "proposal", count: 1, totalValue: 200 },
  );
  assert.equal(context.stages.find((row) => row.stage === "won")?.count, 0);
  const empty = pipelineViewContext(workspace, [], "missing");
  assert.equal(empty.totalValue, 0);
  assert.equal(
    empty.stages.every((row) => row.count === 0 && row.totalValue === 0),
    true,
  );
});

void test("follow-ups and settings publish completion totals and collection usage", () => {
  const tasks = pageViews["/tasks"].parse(tasksViewContext(workspace));
  assert.deepEqual(tasks.summary, { total: 2, pending: 1, completed: 1 });
  assert.equal(tasks.contacts.length, 2);
  const settings = pageViews["/settings"].parse(settingsViewContext(workspace));
  assert.deepEqual(settings, {
    usage: { contacts: 2, deals: 3, tasks: 2, limit: 50 },
    currency: "USD",
  });
});

void test("app page context preserves the requested app and instance identities", () => {
  const context = { appPage: { appId: "app-check", instanceKey: "Sales & growth/2026" } };
  assert.deepEqual(pageViews["/app-pages"].parse(context), context);
});
