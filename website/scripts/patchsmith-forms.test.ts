import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DialogActionsProps as DoomDialogActionsProps } from "../../apps/doom/src/patchsmith.gen";
import type { DialogActionsProps as MessagesDialogActionsProps } from "../../apps/messages/src/patchsmith.gen";
import type { DialogActionsProps as StripeDialogActionsProps } from "../../apps/stripe/src/patchsmith.gen";
import { AppForm, AppDialogActions } from "../components/app-form";
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

void test("legacy dialog actions retain submit button types and external form targets", () => {
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

void test("dialog actions compose inside a form without adding submission controls", () => {
  const actions = createElement(
    AppDialogActions,
    null,
    createElement("button", { type: "button" }, "Cancel"),
    createElement("button", { type: "submit" }, "Save follow-up"),
  );
  const html = renderToStaticMarkup(
    createElement(AppForm, { plain: true }, createElement("input", { required: true }), actions),
  );
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.equal((html.match(/<button\b/g) ?? []).length, 2);
  assert.match(html, /<form>.*<input.*data-slot="dialog-footer".*Save follow-up.*<\/form>/);
  assert.match(html, /flex-row/);
  assert.match(html, /justify-end/);
});

void test("every generated binding exposes composable dialog actions", () => {
  const actions = {} satisfies ComponentProps<typeof AppDialogActions>;
  const generated: [DoomDialogActionsProps, MessagesDialogActionsProps, StripeDialogActionsProps] =
    [actions, actions, actions];
  for (const props of generated) {
    assert.equal(contract.components.DialogActions.fields.safeParse(props).success, true);
  }
  assert.equal(contract.components.DialogActions.children, true);
  assert.equal("onSubmit" in contract.components.Dialog.callbacks, false);
});
