import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DialogProps as DoomDialogProps } from "../../apps/doom/src/patchsmith.gen";
import type { DialogProps as MessagesDialogProps } from "../../apps/messages/src/patchsmith.gen";
import type { DialogProps as StripeDialogProps } from "../../apps/stripe/src/patchsmith.gen";
import { AppForm, type AppDialog } from "../components/app-form";
import { contract } from "../lib/patchsmith";

void test("legacy forms retain their default and custom submit buttons", () => {
  for (const fields of [{}, { submitLabel: "Save follow-up" }, { plain: false, disabled: true }]) {
    const props = contract.components.Form.fields.parse(fields);
    const html = renderToStaticMarkup(createElement(AppForm, props, "Fields"));
    assert.match(html, /<button[^>]*type="submit"/);
    assert.ok(html.includes(props.submitLabel ?? "Save"));
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    if (props.disabled) assert.match(html, /<button[^>]*disabled/);
  }
});

void test("plain forms leave submission controls to their caller", () => {
  const props = contract.components.Form.fields.parse({
    plain: true,
    id: "followup",
    submitLabel: "Legacy save",
  });
  const empty = renderToStaticMarkup(createElement(AppForm, props, "Fields"));
  assert.equal(empty, '<form id="followup">Fields</form>');
  const explicit = renderToStaticMarkup(
    createElement(AppForm, props, createElement("button", { type: "submit" }, "Send")),
  );
  assert.equal((explicit.match(/<button\b/g) ?? []).length, 1);
  assert.match(explicit, />Send<\/button>/);
  assert.doesNotMatch(explicit, /Legacy save/);
});

void test("dialog submit actions require a nonempty form ID; regular actions keep it optional", () => {
  const fields = contract.components.Dialog.fields;
  const dialog = { title: "Follow-up", open: true };
  for (const action of [
    { id: "save", label: "Save", type: "submit" },
    { id: "save", label: "Save", type: "submit", form: "" },
  ]) {
    assert.equal(fields.safeParse({ ...dialog, actions: [action] }).success, false);
  }
  for (const action of [
    { id: "save", label: "Save", type: "submit", form: "followup" },
    { id: "cancel", label: "Cancel" },
    { id: "cancel", label: "Cancel", type: "button" },
    { id: "cancel", label: "Cancel", form: "followup" },
    { id: "cancel", label: "Cancel", type: "button", form: "followup" },
  ]) {
    assert.equal(fields.safeParse({ ...dialog, actions: [action] }).success, true);
  }
});

void test("AppDialog and every generated binding reject unbound submit actions", () => {
  const missingForm = { id: "save", label: "Save", type: "submit" } as const;
  // @ts-expect-error Host-inferred submit actions must target a form.
  const host: NonNullable<ComponentProps<typeof AppDialog>["actions"]>[number] = missingForm;
  // @ts-expect-error Doom's generated submit actions must target a form.
  const doom: NonNullable<DoomDialogProps["actions"]>[number] = missingForm;
  // @ts-expect-error Messages' generated submit actions must target a form.
  const messages: NonNullable<MessagesDialogProps["actions"]>[number] = missingForm;
  // @ts-expect-error Stripe's generated submit actions must target a form.
  const stripe: NonNullable<StripeDialogProps["actions"]>[number] = missingForm;
  for (const action of [host, doom, messages, stripe]) {
    assert.equal(
      contract.components.Dialog.fields.safeParse({
        title: "Follow-up",
        open: true,
        actions: [action],
      }).success,
      false,
    );
  }
});
