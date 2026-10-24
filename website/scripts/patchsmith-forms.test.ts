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

void test("dialog actions submit the host form without IDs and can still target external forms", () => {
  const fields = contract.components.Dialog.fields;
  const dialog = { title: "Follow-up", open: true };
  for (const action of [
    { id: "save", label: "Save", type: "submit", form: "" },
    { id: "save", label: "Save", type: "reset" },
  ]) {
    assert.equal(fields.safeParse({ ...dialog, actions: [action] }).success, false);
  }
  for (const action of [
    { id: "save", label: "Save", type: "submit" },
    { id: "save", label: "Save", type: "submit", form: "followup" },
    { id: "cancel", label: "Cancel" },
    { id: "cancel", label: "Cancel", type: "button" },
    { id: "cancel", label: "Cancel", form: "followup" },
    { id: "cancel", label: "Cancel", type: "button", form: "followup" },
  ]) {
    assert.equal(fields.safeParse({ ...dialog, actions: [action] }).success, true);
  }
});

void test("AppDialog and every generated binding support host-owned form submission", () => {
  const dialog = {
    title: "Follow-up",
    open: true,
    disabled: true,
    actions: [{ id: "save", label: "Save", type: "submit" as const }],
    onSubmit: () => {},
  } satisfies ComponentProps<typeof AppDialog>;
  const generated: [DoomDialogProps, MessagesDialogProps, StripeDialogProps] = [
    dialog,
    dialog,
    dialog,
  ];
  for (const props of generated) {
    assert.equal(contract.components.Dialog.fields.safeParse(props).success, true);
    assert.equal(typeof props.onSubmit, "function");
  }
});
