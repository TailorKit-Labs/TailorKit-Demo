import type { SlotItem } from "patchsmith/react";

type AppPage = SlotItem<true>;

export type AppPageTarget = { appSlug: string; instance: string };

function baseSlug(page: AppPage) {
  return (
    page.app.name
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `app-${page.app.id.slice(0, 8)}`
  );
}

function appSlug(page: AppPage, pages: AppPage[]) {
  const slug = baseSlug(page);
  const duplicates = pages.filter(
    (candidate) => candidate.app.id !== page.app.id && baseSlug(candidate) === slug,
  );
  if (!duplicates.length) return slug;

  let length = 8;
  while (
    length < page.app.id.length &&
    duplicates.some(
      (candidate) => candidate.app.id.slice(0, length) === page.app.id.slice(0, length),
    )
  ) {
    length++;
  }
  return `${slug}-${page.app.id.slice(0, length)}`;
}

function instanceSegment(page: AppPage) {
  // Keep empty keys and URL dot segments addressable without colliding with real keys.
  if (!page.key) return `~${page.app.id.slice(0, 8)}`;
  return page.key === "." || page.key === ".." || page.key.startsWith("~")
    ? `~${page.key}`
    : page.key;
}

export function appPageHref(page: AppPage, pages: AppPage[] = [page]) {
  return `/apps/${encodeURIComponent(appSlug(page, pages))}/${encodeURIComponent(instanceSegment(page))}`;
}

export function findAppPage(pages: AppPage[], target: AppPageTarget) {
  const matches = pages.filter(
    (page) => appSlug(page, pages) === target.appSlug && instanceSegment(page) === target.instance,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function appPageLabel(page: SlotItem<true>) {
  const label = page.metadata.label;
  return typeof label === "string" && label.trim()
    ? label.trim()
    : `${page.app.name ?? page.app.id} · ${page.key}`;
}
