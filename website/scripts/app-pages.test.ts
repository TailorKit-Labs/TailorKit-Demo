import assert from "node:assert/strict";
import { test } from "node:test";
import type { SlotItem } from "patchsmith/react";
import { appPageHref, findAppPage } from "../lib/app-pages";
import { contract } from "../lib/patchsmith";

const page = (id: string, name = "Doom", key = "doom"): SlotItem<true> => ({
  app: { id, name },
  key,
  metadata: {},
  data: {},
});

void test("readable URLs resolve to the workspace installation and actual instance key", () => {
  const doom = page("workspace-installation");
  assert.equal(appPageHref(doom), "/apps/doom/doom");
  assert.equal(findAppPage([doom], { appSlug: "doom", instance: "doom" }), doom);
  assert.equal(findAppPage([doom], { appSlug: "doom", instance: "missing" }), undefined);
  assert.equal(findAppPage([doom], { appSlug: "missing-app", instance: "doom" }), undefined);
});

void test("instance keys remain intact through URL encoding", () => {
  for (const key of ["weekly report", "a/b?c#d", "你好", ".", "..", "~default", ""]) {
    const item = page("installation-123", "Café Reports!", key);
    const url = new URL(appPageHref(item), "https://demo.patchsmith.io");
    const [, , appSlug, instance] = url.pathname.split("/").map(decodeURIComponent);
    assert.equal(appSlug, "cafe-reports");
    assert.equal(findAppPage([item], { appSlug, instance }), item);
  }
});

void test("unnamed apps and empty instance keys get stable ID fallbacks", () => {
  const item = page("12345678-rest", "", "");
  assert.equal(appPageHref(item), "/apps/app-12345678/~12345678");
});

void test("duplicate app names use distinct IDs, including shared ID prefixes", () => {
  const first = page("12345678-a");
  const second = page("12345678-b");
  const anotherInstance = page(first.app.id, "Doom", "second");
  const pages = [first, second, anotherInstance];
  assert.notEqual(appPageHref(first, pages), appPageHref(second, pages));
  for (const item of pages) {
    const [, , appSlug, instance] = appPageHref(item, pages).split("/").map(decodeURIComponent);
    assert.equal(findAppPage(pages, { appSlug, instance }), item);
  }
  assert.equal(findAppPage(pages, { appSlug: "doom", instance: "doom" }), undefined);
});

void test("app navigation accepts readable paths and rejects old or unsafe destinations", () => {
  const input = contract.tools.ui.navigate.definition.input;
  assert.ok(input);
  for (const href of [
    "/apps/doom/doom",
    "/apps/reports/weekly%20report",
    "/apps/reports/a%2Fb%3Fc%23d",
    "/contacts/contact-1",
  ]) {
    assert.equal(input.safeParse({ href }).success, true, href);
  }
  for (const href of [
    "/app-pages/installation-1?instance=doom",
    "https://example.com/apps/doom/doom",
    "//example.com/apps/doom/doom",
    "/apps/doom",
    "/apps/doom/doom/extra",
    "/apps/../doom",
    "/apps/doom/%2e%2e",
    "/apps/doom/doom?redirect=https://example.com",
    "/apps/doom/doom#fragment",
  ]) {
    assert.equal(input.safeParse({ href }).success, false, href);
  }
});
