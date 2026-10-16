import type { SlotItem } from "tailorkit/react";

export function appPageHref(page: SlotItem<true>) {
  return `/app-pages/${encodeURIComponent(page.app.id)}?instance=${encodeURIComponent(page.key)}`;
}

export function appPageLabel(page: SlotItem<true>) {
  const label = page.metadata.label;
  return typeof label === "string" && label.trim()
    ? label.trim()
    : `${page.app.name ?? page.app.id} · ${page.key}`;
}
