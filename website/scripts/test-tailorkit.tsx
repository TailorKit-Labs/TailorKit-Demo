import "./test-env";
import assert from "node:assert/strict";
import type { ToolContext } from "tailorkit";
import type { SlotItem } from "tailorkit/react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, pool } from "../lib/drizzle";
import { contacts, deals, tasks, user } from "../lib/schema";
import { provisionForUser } from "../lib/provision";
import { contract, siteHref } from "../lib/tailorkit";
import { createTailorKitServerTools } from "../lib/tailorkit-server-tools";
import { tailorKitComponents } from "../components/tailorkit-components";
import { appPageHref, appPageLabel } from "../lib/app-pages";
import { agentRequest } from "../lib/agents/agent-request";

async function main() {
  assert.equal(contract.slots.page.multiple, true);
  const reports: SlotItem<true> = {
    app: { id: "test-app", name: "Workspace tools" },
    key: "reports",
    metadata: { label: " Reports " },
    data: {},
  };
  const activity = { ...reports, key: "activity", metadata: { label: "Activity" } };
  assert.equal(appPageLabel(reports), "Reports");
  assert.equal(appPageLabel(activity), "Activity");
  assert.notEqual(appPageHref(reports), appPageHref(activity));
  for (const label of [undefined, "", "   ", 42, {}]) {
    assert.equal(appPageLabel({ ...reports, metadata: { label } }), "Workspace tools · reports");
  }
  assert.equal(
    appPageLabel({ ...reports, app: { id: "unnamed" }, metadata: {} }),
    "unnamed · reports",
  );
  for (const key of [
    "reports",
    "activity",
    "report/2026",
    "Sales & growth?",
    "..",
    "日本語",
    "%2F",
  ]) {
    const href = appPageHref({ ...reports, key });
    const url = new URL(href, "http://localhost:3000");
    assert.equal(url.pathname, "/app-pages/test-app");
    assert.equal(url.searchParams.get("instance"), key);
    assert.equal(siteHref.safeParse(href).success, true);
  }
  assert.equal(agentRequest.shape.page.safeParse("/app-pages").success, true);
  const users: string[] = [];
  try {
    const tenants = [];
    for (let i = 0; i < 2; i++) {
      const response = await auth.api.signInAnonymous({ asResponse: true });
      const payload = await response.json();
      users.push(payload.user.id);
      tenants.push(await provisionForUser(payload.user.id));
    }
    const [tenant, foreign] = tenants;
    const scope = { name: "workspace", value: { workspaceId: tenant.id } };
    const context: ToolContext = {
      scope,
      requestId: "contract-integration",
      identity: {
        scope,
        subjectId: tenant.userId,
        installationId: "test",
        appId: "test",
        projectId: "test",
        deploymentId: "test",
        expiresAt: Date.now() + 60000,
      },
    };
    const tools = createTailorKitServerTools();
    const initial = await tools.workspace.get({ input: {}, context });
    assert.equal(initial.usage.contacts, 30);
    assert.equal(initial.usage.limit, 50);

    const created = await tools.contacts.create({
      input: {
        name: "Contract Contact",
        email: "contract@example.com",
        company: "TailorKit",
        role: "Builder",
        status: "lead",
      },
      context,
    });
    const id = created.contact.id;
    await tools.contacts.update({ input: { ...created.contact, status: "customer" }, context });
    const filtered = await tools.contacts.list({
      input: { query: "Contract Contact", status: "customer" },
      context,
    });
    assert.deepEqual(
      filtered.contacts.map((row) => row.id),
      [id],
    );
    const deal = await tools.deals.create({
      input: { title: "Contract Deal", value: 1200, contactId: id },
      context,
    });
    const task = await tools.tasks.create({
      input: { title: "Contract Task", dueDate: "2026-10-20", contactId: id },
      context,
    });
    const note = await tools.activities.addNote({
      input: { contactId: id, body: "Extension note" },
      context,
    });
    const detail = await tools.contacts.get({ input: { id }, context });
    assert.equal(detail.contact.status, "customer");
    assert.deepEqual(
      detail.deals.map((row) => row.id),
      [deal.deal.id],
    );
    assert.deepEqual(
      detail.tasks.map((row) => row.id),
      [task.task.id],
    );
    assert.ok(
      detail.activities.some((row) => row.id === note.id && row.description === "Extension note"),
    );
    const activity = await tools.activities.list({ input: { contactId: id }, context });
    assert.equal(activity.count, detail.activities.length);
    await tools.deals.update({
      input: { ...deal.deal, title: "Edited Contract Deal", value: 2400, stage: "proposal" },
      context,
    });
    const listed = await tools.deals.list({ input: { contactId: id }, context });
    assert.equal(listed.totalValue, 2400);
    assert.equal(listed.deals[0].title, "Edited Contract Deal");
    const target = await tools.deals.create({
      input: { title: "Ordering target", value: 0, stage: "proposal" },
      context,
    });
    await tools.deals.move({
      input: { id: deal.deal.id, stage: "proposal", targetId: target.deal.id, placement: "after" },
      context,
    });
    const ordered = await tools.deals.list({ input: { stage: "proposal" }, context });
    const targetIndex = ordered.deals.findIndex((row) => row.id === target.deal.id);
    assert.equal(ordered.deals[targetIndex + 1].id, deal.deal.id);
    await tools.tasks.setCompleted({ input: { id: task.task.id, completed: true }, context });
    await tools.tasks.update({
      input: { ...task.task, title: "Edited task", dueDate: "2026-11-01" },
      context,
    });
    const listedTasks = await tools.tasks.list({
      input: { contactId: id, completed: true },
      context,
    });
    assert.equal(listedTasks.tasks[0].dueDate, "2026-11-01");
    assert.equal(listedTasks.tasks[0].title, "Edited task");

    const [otherContact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.tenantId, foreign.id));
    const [otherDeal] = await db.select().from(deals).where(eq(deals.tenantId, foreign.id));
    const [otherTask] = await db.select().from(tasks).where(eq(tasks.tenantId, foreign.id));
    for (const attempt of [
      () => tools.contacts.get({ input: { id: otherContact.id }, context }),
      () => tools.contacts.update({ input: { ...created.contact, id: otherContact.id }, context }),
      () => tools.contacts.delete({ input: { id: otherContact.id }, context }),
      () => tools.deals.update({ input: { ...deal.deal, id: otherDeal.id }, context }),
      () => tools.deals.update({ input: { ...deal.deal, contactId: otherContact.id }, context }),
      () => tools.deals.delete({ input: { id: otherDeal.id }, context }),
      () =>
        tools.deals.move({
          input: { id: deal.deal.id, stage: "proposal", targetId: otherDeal.id },
          context,
        }),
      () => tools.tasks.update({ input: { ...task.task, id: otherTask.id }, context }),
      () => tools.tasks.update({ input: { ...task.task, contactId: otherContact.id }, context }),
      () => tools.tasks.delete({ input: { id: otherTask.id }, context }),
      () =>
        tools.activities.addNote({
          input: { contactId: otherContact.id, body: "Forbidden" },
          context,
        }),
      () =>
        tools.workspace.get({
          input: {},
          context: { ...context, scope: { name: "other", value: {} } },
        }),
      () =>
        tools.workspace.get({
          input: {},
          context: { ...context, scope: { name: "workspace", value: {} } },
        }),
      () => tools.tasks.update({ input: { ...task.task, dueDate: "invalid" }, context }),
    ])
      await assert.rejects(attempt);

    await tools.contacts.delete({ input: { id }, context });
    await assert.rejects(() => tools.contacts.get({ input: { id }, context }), /Contact not found/);
    const orphanedDeal = await tools.deals.list({
      input: { query: "Edited Contract Deal" },
      context,
    });
    const orphanedTask = await tools.tasks.list({ input: { query: "Edited task" }, context });
    assert.equal(orphanedDeal.deals[0].contactId, null);
    assert.equal(orphanedTask.tasks[0].contactId, null);
    assert.equal((await tools.activities.list({ input: { contactId: id }, context })).count, 0);
    await tools.deals.delete({ input: { id: deal.deal.id }, context });
    await tools.deals.delete({ input: { id: target.deal.id }, context });
    await tools.tasks.delete({ input: { id: task.task.id }, context });
    const final = await tools.workspace.get({ input: {}, context });
    assert.deepEqual(final.usage, initial.usage);

    for (const href of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "javascript:alert(1)",
      "/api/auth/sign-out",
      "/contacts/../settings",
      "/app-pages/test-app",
      "/app-pages/test-app?instance=",
      "/app-pages/test-app?instance=reports&redirect=https://evil.test",
      "/app-pages/../settings?instance=reports",
      "/app-pages/test-app?instance=%ZZ",
    ])
      assert.equal(siteHref.safeParse(href).success, false);
    for (const href of ["/", "/contacts", `/contacts/${id}`, "/pipeline", "/tasks", "/settings"])
      assert.equal(siteHref.safeParse(href).success, true);
    const inputMarkup = renderToStaticMarkup(
      tailorKitComponents.Input({
        props: { label: "Title", value: "Contract value", onChange: () => {} },
      }),
    );
    assert.ok(inputMarkup.includes('aria-label="Title"'));
    assert.ok(inputMarkup.includes('value="Contract value"'));
    let changed = "";
    const input = tailorKitComponents.Input({
      props: {
        label: "Title",
        value: "",
        onChange: ({ value }) => {
          changed = value;
        },
      },
    });
    input.props.children.props.onChange({ currentTarget: { value: "Typed value" } });
    assert.equal(changed, "Typed value", "DOM events cross the contract as serializable values");
    assert.equal(
      contract.components.Button.fields.safeParse({ label: "Save", variant: "unknown" }).success,
      false,
    );
    const form = renderToStaticMarkup(
      tailorKitComponents.Form({
        props: { submitLabel: "Create", disabled: true, onSubmit: () => {} },
        children: null,
      }),
    );
    assert.ok(form.includes('type="submit"'));
    assert.ok(form.includes("Create"));
    console.log(
      "PASS: TailorKit contract CRUD, filtering, notes, ordering, output validation, tenant isolation, cascade behavior, safe navigation, multiple app page identities/labels/URLs and form rendering/callbacks.",
    );
  } finally {
    for (const id of users) await db.delete(user).where(eq(user.id, id));
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
