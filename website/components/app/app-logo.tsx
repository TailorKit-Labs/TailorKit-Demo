"use client";

import { useState } from "react";
import Image from "next/image";
import { BlocksIcon } from "lucide-react";
import { patchsmithClient } from "@/lib/patchsmith-client";

function AppLogoImage({ path }: { path?: string }) {
  const [failed, setFailed] = useState(false);
  if (!path || failed) return <BlocksIcon className="size-4" />;
  const baseUrl = new URL(patchsmithClient.baseUrl);
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  const url = new URL(path, baseUrl);
  // Keep relative assets independent of the server's placeholder origin during SSR.
  const src = URL.canParse(path) ? url.href : `${url.pathname}${url.search}${url.hash}`;

  return (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      className="size-4 object-contain"
      draggable={false}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

export function AppLogo({ app }: { app: { logoPaths?: { light?: string; dark?: string } } }) {
  const light = app.logoPaths?.light ?? app.logoPaths?.dark;
  const dark = app.logoPaths?.dark ?? light;

  return (
    <span aria-hidden="true" className="size-4 shrink-0">
      <span className="block dark:hidden">
        <AppLogoImage key={light} path={light} />
      </span>
      <span className="hidden dark:block">
        <AppLogoImage key={dark} path={dark} />
      </span>
    </span>
  );
}
